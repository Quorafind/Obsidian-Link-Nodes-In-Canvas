import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	ItemView,
	Notice,
	Plugin, prepareFuzzySearch, setIcon,
	TFile
} from 'obsidian';
import { AllCanvasNodeData, CanvasTextData, NodeSide } from "./canvas";
import { CanvasEdgeData } from "obsidian/canvas";

export default class LinkNodesInCanvas extends Plugin {
	async onload() {
		this.registerCustomCommands();
		this.registerCustomSuggester();
	}

	registerCustomCommands() {
		this.addCommand({
			id: 'link-between-selection-nodes',
			name: 'Link Between Selection Nodes',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const canvasView = this.app.workspace.getActiveViewOfType(ItemView);
				if (canvasView?.getViewType() === "canvas") {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						// @ts-ignore
						const canvas = canvasView.canvas;
						const selection = canvas.selection;
						// @ts-ignore
						const fileNodes = Array.from(selection).filter((node) => node?.filePath !== undefined);
						if (fileNodes.length === 0) return;

						const resolvedLinks = this.app.metadataCache.resolvedLinks;
						const allEdgesData: CanvasEdgeData[] = [];
						fileNodes.forEach((node) => {
							// @ts-ignore
							const allLinks = (Object.keys(resolvedLinks[node.filePath]) as Array<string>);
							for (let i = 0; i < fileNodes.length; i++) {
								// @ts-ignore
								if (allLinks.includes(fileNodes[i].filePath)) {
									if (node !== fileNodes[i]) {
										const newEdge = this.createEdge(node, fileNodes[i], canvas);
										allEdgesData.push(newEdge);
									}
								}
							}
						});

						const currentData = canvas.getData();
						currentData.edges = [
							...currentData.edges,
							...allEdgesData,
						];

						canvas.setData(currentData);
						canvas.requestSave();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});
	}

	registerCustomSuggester() {
		this.registerEditorSuggest(new NodeSuggest(this));
	}

	createEdge(node1: any, node2: any, canvas: any) {
		const random = (e: number) => {
			let t = [];
			for (let n = 0; n < e; n++) {
				t.push((16 * Math.random() | 0).toString(16));
			}
			return t.join("");
		};

		const edgeData: CanvasEdgeData = {
			id: random(16),
			fromSide: 'right',
			fromNode: node1.id,
			toSide: 'left',
			toNode: node2.id
		};

		return edgeData;
	}

	createEdgeBasedOnNodes(node1: any, node2: any, canvas: any, side: NodeSide) {
		const random = (e: number) => {
			let t = [];
			for (let n = 0; n < e; n++) {
				t.push((16 * Math.random() | 0).toString(16));
			}
			return t.join("");
		};
		let tempEdge: any;
		let fromTargetSide: NodeSide;
		let toTargetSide: NodeSide;

		switch (side) {
			case "left":
				fromTargetSide = "left";
				toTargetSide = "right";
				break;
			case "right":
				fromTargetSide = "right";
				toTargetSide = "left";
				break;
			case "top":
				fromTargetSide = "top";
				toTargetSide = "bottom";
				break;
			case "bottom":
				fromTargetSide = "bottom";
				toTargetSide = "top";
				break;
			case "top-left":
				fromTargetSide = "top";
				toTargetSide = "right";
				break;
			case "top-right":
				fromTargetSide = "top";
				toTargetSide = "left";
				break;
			case "bottom-left":
				fromTargetSide = "bottom";
				toTargetSide = "right";
				break;
			case "bottom-right":
				fromTargetSide = "bottom";
				toTargetSide = "left";
				break;
		}

		tempEdge = {
			id: random(16),
			fromSide: fromTargetSide,
			fromNode: node1.id,
			toSide: toTargetSide,
			toNode: node2.id
		};

		const currentData = canvas.getData();

		if (currentData.edges.some((edge: CanvasEdgeData) => {
			return edge.fromNode === tempEdge.fromNode && edge.toNode === tempEdge.toNode;
		})) {
			new Notice("Edge already exists between nodes");
			return;
		}

		currentData.edges = [
			...currentData.edges,
			tempEdge,
		];

		canvas.setData(currentData);
		canvas.requestSave();

	}

	onunload() {

	}
}

class NodeSuggest extends EditorSuggest<AllCanvasNodeData> {
	private plugin: LinkNodesInCanvas;
	private original: any;
	private target: any;

	private nodes: AllCanvasNodeData[] = [];
	private canvas: any;

	private fuzzySearch: ReturnType<typeof prepareFuzzySearch>;
	private end: number | undefined;
	private lineContents: string;

	constructor(plugin: LinkNodesInCanvas) {
		super(plugin.app);
		this.plugin = plugin;

		this.setInstructions([
			{
				command: 'Ctrl/Cmd + Enter',
				purpose: 'Link to node and generate link',
			}
		]);

		this.scope.register(['Mod'], 'Enter', (evt) => {
			evt.preventDefault();

			// @ts-ignore
			this.suggestions.useSelectedItem(evt);
		});
	}

	getNodes(): AllCanvasNodeData[] {
		const canvasView = this.plugin.app.workspace.getActiveViewOfType(ItemView);

		if (canvasView?.getViewType() === "canvas") {
			// @ts-ignore
			this.canvas = canvasView.canvas;
			// @ts-ignore
			const nodes = this.canvas.getData().nodes;

			return Array.from(nodes.values());
		}
		return [];
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_: TFile
	): EditorSuggestTriggerInfo | null {
		this.lineContents = editor.getLine(cursor.line).toLowerCase();
		const before = this.lineContents.slice(0, cursor.ch);
		const after = this.lineContents.slice(cursor.ch);
		this.end = after.indexOf("}}");

		const firstIndex = before.lastIndexOf("{{");
		const lastIndex = before.lastIndexOf("}}");

		if (!(firstIndex > lastIndex && lastIndex === -1)) return null;

		const query = before.slice(firstIndex + 2);
		this.nodes = this.getNodes();

		this.original = Array.from(this.canvas.selection)[0];


		return {
			end: cursor,
			start: {
				ch: firstIndex,
				line: cursor.line,
			},
			query: query,
		};
	}

	getSuggestions(context: EditorSuggestContext): AllCanvasNodeData[] {
		const query = context.query.toLowerCase() || "";
		this.fuzzySearch = prepareFuzzySearch(query);

		const results = this.nodes.filter((node) => {
			switch (node.type) {
				case "text":
					if (node.id === this.original.id || node.text.trim() === "") return false;
					return this.fuzzySearch(node.text.toLowerCase());
				case "file":
					return this.fuzzySearch(node.file.toLowerCase());
				case "group":
					if (node.label?.trim()) return this.fuzzySearch(node.label?.toLowerCase());
					else return false;
				case "link":
					if (node.url.trim().length === 0) return false;
					return this.fuzzySearch(node.url.toLowerCase());
			}
		});

		return results;
	}

	renderSuggestion(suggestion: AllCanvasNodeData, el: HTMLElement): void {
		let outer: HTMLElement;
		let iconEl: HTMLElement;
		outer = el.createDiv({cls: "ltn-suggester-container"});
		switch (suggestion.type) {
			case "text":
				iconEl = outer.createDiv({cls: "ltn-suggester-icon"});
				setIcon(iconEl, "sticky-note");
				outer.createDiv({cls: "ltn-text-node"}).setText(`${suggestion.text}`);
				break;
			case "file":
				iconEl = outer.createDiv({cls: "ltn-suggester-icon"});
				setIcon(iconEl, "file-text");
				outer.createDiv({cls: "ltn-file-node"}).setText(`${suggestion.file}`);
				break;
			case "group":
				iconEl = outer.createDiv({cls: "ltn-suggester-icon"});
				setIcon(iconEl, "box-select");
				outer.createDiv({cls: "ltn-group-node"}).setText(`${suggestion.label}`);
				break;
			case "link":
				iconEl = outer.createDiv({cls: "ltn-suggester-icon"});
				setIcon(iconEl, "link");
				outer.createDiv({cls: "ltn-link-node"}).setText(`${suggestion.url}`);
				break;
		}

	}

	selectSuggestion(suggestion: AllCanvasNodeData, evt: MouseEvent | KeyboardEvent): void {
		if (this.context) {
			const editor = (this.context.editor as Editor);
			const updatedText = (evt.ctrlKey || evt.metaKey) && suggestion.type === 'file' ? `[[${suggestion.file}]]` : '';
			editor.replaceRange(
				updatedText,
				this.context.start,
				this.end === 0 ? {
					ch: this.context.end.ch + 2,
					line: this.context.end.line
				} : this.context.end
			);
			editor.setCursor({
				line: this.context.end.line,
				ch: this.context.end.ch + updatedText?.length - 2
			});

			const targetNode = this.canvas.nodes.get(suggestion.id);
			const side = this.getDirectionText(this.original.x, this.original.y, targetNode.x, targetNode.y);

			this.plugin.createEdgeBasedOnNodes(this.original, targetNode, this.canvas, side);

			this.close();
		}
	}

	getDirectionText(originalX: number, originalY: number, targetX: number, targetY: number): NodeSide {
		const x = originalX - targetX;
		const y = originalY - targetY;
		const angle = Math.atan2(y, x) * 180 / Math.PI;
		const direction = Math.round((angle + 180) / 45) % 8;

		switch (direction) {
			case 0:
				return "right";
			case 1:
				return "bottom-right";
			case 2:
				return "bottom";
			case 3:
				return "bottom-left";
			case 4:
				return "left";
			case 5:
				return "top-left";
			case 6:
				return "top";
			case 7:
				return "top-right";
			default:
				return "right";
		}
	}
}
