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

export default class LinkNodesInCanvas extends Plugin {
	async onload() {
		this.registerCustomCommands()
		this.registerCustomSuggester()
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
						const fileNodes = Array.from(selection).filter((node)=> node?.filePath !== undefined);
						if(fileNodes.length === 0) return;

						const resolvedLinks = app.metadataCache.resolvedLinks;
						fileNodes.forEach((node)=> {
							// @ts-ignore
							const allLinks = (Object.keys(resolvedLinks[node.filePath]) as Array<string>);
							for(let i = 0; i < fileNodes.length; i++) {
								// @ts-ignore
								if(allLinks.includes(fileNodes[i].filePath)) {
									if(node !== fileNodes[i]) this.createEdge(node, fileNodes[i], canvas);
								}
							}
						});
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
			return t.join("")
		}

		const edge = canvas.edges.get(canvas.getData().edges.first()?.id);

		if(edge) {
			const tempEdge = new edge.constructor(canvas, random(16), {side: "right", node: node1}, {side: "left", node: node2})
			canvas.addEdge(tempEdge);
			tempEdge.attach();
			tempEdge.render();
		}else {
			new Notice("You should have at least one edge in the canvas to use this command.");
		}
	}

	createEdgeBasedOnNodes(node1: any, node2: any, canvas: any, side: NodeSide) {
		const random = (e: number) => {
			let t = [];
			for (let n = 0; n < e; n++) {
				t.push((16 * Math.random() | 0).toString(16));
			}
			return t.join("")
		}

		const edge = canvas.edges.get(canvas.getData().edges.first()?.id);

		if(edge) {
			let tempEdge: any;

			console.log(side);

			switch (side) {
				case "left":
					tempEdge = new edge.constructor(canvas, random(16), {side: "left", node: node1}, {side: "right", node: node2})
					break;
				case "right":
					tempEdge = new edge.constructor(canvas, random(16), {side: "right", node: node1}, {side: "left", node: node2})
					break;
				case "top":
					tempEdge = new edge.constructor(canvas, random(16), {side: "top", node: node1}, {side: "bottom", node: node2})
					break;
				case "bottom":
					tempEdge = new edge.constructor(canvas, random(16), {side: "bottom", node: node1}, {side: "top", node: node2})
					break;
				case "top-left":
					tempEdge = new edge.constructor(canvas, random(16), {side: "top", node: node1}, {side: "right", node: node2})
					break;
				case "top-right":
					tempEdge = new edge.constructor(canvas, random(16), {side: "top", node: node1}, {side: "left", node: node2})
					break;
				case "bottom-left":
					tempEdge = new edge.constructor(canvas, random(16), {side: "bottom", node: node1}, {side: "right", node: node2})
					break;
				case "bottom-right":
					tempEdge = new edge.constructor(canvas, random(16), {side: "bottom", node: node1}, {side: "left", node: node2})
					break;
			}

			canvas.addEdge(tempEdge);

			tempEdge.attach();
			tempEdge.render();
		}else {
			new Notice("You should have at least one edge in the canvas to use this command.");
		}
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
					if(node.text.toLowerCase().contains(this.lineContents) || node.text.trim() === "") return false;
					return this.fuzzySearch(node.text.toLowerCase());
				case "file":
					return this.fuzzySearch(node.file.toLowerCase());
				case "group":
					if(node.label?.trim()) return this.fuzzySearch(node.label?.toLowerCase());
					else return false;
				case "link":
					if(node.url.trim().length === 0) return false;
					return this.fuzzySearch(node.url.toLowerCase());
			}
		});

		return results;
	}

	renderSuggestion(suggestion: AllCanvasNodeData, el: HTMLElement): void {
		let outer: HTMLElement;
		let iconEl: HTMLElement;
		outer = el.createDiv({ cls: "ltn-suggester-container" });
		switch (suggestion.type) {
			case "text":
				iconEl = outer.createDiv({ cls: "ltn-suggester-icon" });
				setIcon(iconEl, "sticky-note");
				outer.createDiv({ cls: "ltn-text-node" }).setText(`${suggestion.text}`);
				break;
			case "file":
				iconEl = outer.createDiv({ cls: "ltn-suggester-icon" });
				setIcon(iconEl, "file-text");
				outer.createDiv({ cls: "ltn-file-node" }).setText(`${suggestion.file}`);
				break;
			case "group":
				iconEl = outer.createDiv({ cls: "ltn-suggester-icon" });
				setIcon(iconEl, "box-select");
				outer.createDiv({ cls: "ltn-group-node" }).setText(`${suggestion.label}`);
				break;
			case "link":
				iconEl = outer.createDiv({ cls: "ltn-suggester-icon" });
				setIcon(iconEl, "link");
				outer.createDiv({ cls: "ltn-link-node" }).setText(`${suggestion.url}`);
				break;
		}

	}

	selectSuggestion(suggestion: AllCanvasNodeData): void {
		if (this.context) {
			(this.context.editor as Editor).replaceRange(
				``,
				this.context.start,
				this.end === 0 ? {
					ch: this.context.end.ch + 2,
					line: this.context.end.line
				} : this.context.end
			);

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
