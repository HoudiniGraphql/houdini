import { PluginContext } from "houdini/vite"
import { PluginOption } from "vite"


export default function(ctx: PluginContext): PluginOption {
  return {
    name: "houdini-react"
  }
}
