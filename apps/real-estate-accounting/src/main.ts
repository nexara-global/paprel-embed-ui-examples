import "../styles.css";
import { App } from "./app";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root element");

void new App(root).start();
