import ReactDOM from "react-dom/client";
import { loadComponentOptions } from "./utils/componentOptions";
import { BrowserRouter } from "react-router-dom";
import './index.css'
import { installAuthFetch } from "./utils/authFetch";

installAuthFetch();

async function startApp() {
  try {
    await loadComponentOptions();
  } catch (error) {
    console.error(error);
  }
  const { default: App } = await import("./App");
  ReactDOM.createRoot(document.getElementById("root")).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

startApp();
