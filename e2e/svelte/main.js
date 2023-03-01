import client from "../client";
import './app.css'
import App from './App.svelte'
import { logGreen } from '@kitql/helper'

client.init();

const app = new App({
	target: document.getElementById('app')
})

export default app
