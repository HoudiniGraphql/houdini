import { graphql, useMutationForm } from '$houdini'

// A file-upload form. The mutation takes a File scalar, so the compiler flags the form
// multipart and useMutationForm sets enctype="multipart/form-data". The enhanced path
// sends the File through the normal client multipart pipeline; the no-JS path posts it
// natively for the server form handler to assemble into a multipart GraphQL request.
export default function UploadFormView() {
	const { form, hidden, state, pending } = useMutationForm(
		graphql(`
			mutation MutationFormUpload($file: File!) @endpoint {
				singleUpload(file: $file)
			}
		`)
	)

	return (
		<form {...form} data-testid="upload-form">
			{hidden}
			<input type="file" name="file" data-testid="file-input" />
			<button type="submit" data-testid="submit" disabled={pending}>
				{pending ? 'Uploading…' : 'Upload'}
			</button>
			{/* the resolver echoes the uploaded file's contents back */}
			{state?.data && <p data-testid="result">{state.data.singleUpload}</p>}
			{state?.errors && (
				<p role="alert" data-testid="error">
					{state.errors[0].message}
				</p>
			)}
		</form>
	)
}
