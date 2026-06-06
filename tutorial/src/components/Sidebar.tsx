import { marked } from 'marked'
import { useTutorial } from '../lib/state'

export function Sidebar() {
	const { currentStep } = useTutorial()

	return (
		<div
			className={`
				h-full overflow-y-auto p-6 bg-surface-raised text-sm leading-relaxed text-fg
				[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-fg [&_h1]:mb-3
				[&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_h2]:mt-5 [&_h2]:mb-2
				[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-fg [&_h3]:mt-4 [&_h3]:mb-1
				[&_p]:mb-3
				[&_a]:text-graphql [&_a:hover]:opacity-80 [&_a]:underline
				[&_code]:bg-surface-overlay [&_code]:text-graphql [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
				[&_pre]:bg-surface-deep [&_pre]:rounded [&_pre]:p-4 [&_pre]:mb-3 [&_pre]:overflow-x-auto
				[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-fg-muted
				[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
				[&_li]:mb-1
			`}
			dangerouslySetInnerHTML={{
				__html: currentStep
					? marked.parse(currentStep.markdown ?? currentStep.title)
					: '<p>Select a step to begin.</p>',
			}}
		/>
	)
}
