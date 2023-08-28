import { sveltekit } from '@sveltejs/kit/vite'
import houdini from 'houdini/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [houdini(), sveltekit()]
});
