import { ItemView, Notice, Plugin } from 'obsidian';

export default class MyPlugin extends Plugin {
	async onload() {
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
		                const canvas = canvasView.canvas;
						const selection = canvas.selection;
						const fileNodes = Array.from(selection).filter((node)=> node?.filePath !== undefined);
						if(fileNodes.length === 0) return;

						const resolvedLinks = app.metadataCache.resolvedLinks;
						fileNodes.forEach((node)=> {
							const allLinks = (Object.keys(resolvedLinks[node.filePath]) as Array<string>);
							for(let i = 0; i < fileNodes.length; i++) {
								if(allLinks.includes(fileNodes[i].filePath)) {
									if(node !== fileNodes[i]) this.createEdge(node, fileNodes[i], canvas);
								}
							}
							canvas.requestSave();

						});
		            }

		            // This command will only show up in Command Palette when the check function returns true
		            return true;
		        }
		    }
		});
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

	onunload() {

	}
}
