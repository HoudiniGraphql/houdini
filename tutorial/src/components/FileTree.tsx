import { useMemo, useRef, useState } from 'react'
import { useTutorial } from '../lib/state'

type FileNode = { type: 'file'; path: string; name: string }
type DirNode  = { type: 'dir';  name: string; children: TreeNode[] }
type TreeNode = FileNode | DirNode

function buildTree(paths: string[]): TreeNode[] {
	const root: DirNode = { type: 'dir', name: '', children: [] }

	for (const path of paths) {
		const parts = path.split('/')
		let node = root
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]
			if (i === parts.length - 1) {
				node.children.push({ type: 'file', path, name: part })
			} else {
				let dir = node.children.find((c): c is DirNode => c.type === 'dir' && c.name === part)
				if (!dir) {
					dir = { type: 'dir', name: part, children: [] }
					node.children.push(dir)
				}
				node = dir
			}
		}
	}

	const sort = (nodes: TreeNode[]) => {
		nodes.sort((a, b) => {
			if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
			return a.name.localeCompare(b.name)
		})
		for (const n of nodes) if (n.type === 'dir') sort(n.children)
	}
	sort(root.children)

	return root.children
}

function DirEntry({
	node,
	dirPath,
	depth,
	selectedFile,
	stepFiles,
	openDirs,
	onSelect,
}: {
	node: DirNode
	dirPath: string
	depth: number
	selectedFile: string | null
	stepFiles: Set<string>
	openDirs: Set<string>
	onSelect: (path: string) => void
}) {
	const [open, setOpen] = useState(() => openDirs.has(dirPath))

	const prevOpenDirs = useRef(openDirs)
	if (prevOpenDirs.current !== openDirs) {
		prevOpenDirs.current = openDirs
		if (open !== openDirs.has(dirPath)) setOpen(openDirs.has(dirPath))
	}
	const indent = depth * 12

	return (
		<li>
			<button
				onClick={() => setOpen((o) => !o)}
				className="w-full text-left flex items-center gap-1 py-1 text-xs font-mono text-fg-subtle hover:text-fg-muted transition-colors"
				style={{ paddingLeft: `${8 + indent}px` }}
			>
				<span className={`text-[9px] transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
				{node.name}
			</button>
			{open && (
				<ul>
					{node.children.map((child) =>
						child.type === 'dir' ? (
							<DirEntry
								key={child.name}
								node={child}
								dirPath={`${dirPath}/${child.name}`}
								depth={depth + 1}
								selectedFile={selectedFile}
								stepFiles={stepFiles}
								openDirs={openDirs}
								onSelect={onSelect}
							/>
						) : (
							<FileEntry
								key={child.path}
								node={child}
								depth={depth + 1}
								selectedFile={selectedFile}
								stepFiles={stepFiles}
								onSelect={onSelect}
							/>
						)
					)}
				</ul>
			)}
		</li>
	)
}

function FileEntry({
	node,
	depth,
	selectedFile,
	stepFiles,
	onSelect,
}: {
	node: FileNode
	depth: number
	selectedFile: string | null
	stepFiles: Set<string>
	onSelect: (path: string) => void
}) {
	const isEditable = stepFiles.has(node.path)
	const isSelected = selectedFile === node.path
	const indent = depth * 12

	return (
		<li>
			<button
				onClick={() => onSelect(node.path)}
				title={node.path}
				className={`w-full text-left py-1 text-xs font-mono truncate transition-colors ${
					isSelected
						? 'bg-surface-overlay text-fg'
						: 'text-fg-muted hover:bg-surface-raised hover:text-fg'
				}`}
				style={{ paddingLeft: `${8 + indent}px` }}
			>
				<span className={isEditable ? 'text-graphql' : ''}>{node.name}</span>
			</button>
		</li>
	)
}

export function FileTree() {
	const { files, wcFiles, selectedFile, selectFile, currentStep, openDirs } = useTutorial()

	const allFiles = [...new Set([...Object.keys(files), ...wcFiles])].sort()
	const tree = buildTree(allFiles)
	const stepFiles = new Set(Object.keys(currentStep?.files ?? {}))
	const openDirSet = useMemo(() => new Set(openDirs), [openDirs])

	return (
		<div className="flex flex-col h-full bg-surface border-r border-edge">
			<ul className="flex-1 overflow-y-auto py-1">
				{tree.map((node) =>
					node.type === 'dir' ? (
						<DirEntry
							key={node.name}
							node={node}
							dirPath={node.name}
							depth={0}
							selectedFile={selectedFile}
							stepFiles={stepFiles}
							openDirs={openDirSet}
							onSelect={selectFile}
						/>
					) : (
						<FileEntry
							key={node.path}
							node={node}
							depth={0}
							selectedFile={selectedFile}
							stepFiles={stepFiles}
							onSelect={selectFile}
						/>
					)
				)}
			</ul>
		</div>
	)
}
