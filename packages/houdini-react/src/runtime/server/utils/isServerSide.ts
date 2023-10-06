import { isClientSide } from './isClientSide'

export { isServerSide }

function isServerSide() {
	return !isClientSide()
}
