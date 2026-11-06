import { API_BASE } from "./componentRates";
import { catalogs } from "../pages/Admin/ComponentRates";
import { AIO_OPTIONS } from "../pages/Aio/User/AioConfig";
import { SSD1_OPTIONS } from "../pages/Workstation/User/WorkstationConfig";

// Populate the existing shared lists before loading screens that derive their
// own processor/motherboard lists. Each product retains its own options.
export async function loadComponentOptions() {
  const response = await fetch(`${API_BASE}/component-options/`);
  if (!response.ok) throw new Error("Additional components could not be loaded.");
  const { options = [] } = await response.json();
  for (const option of options) {
    const group = catalogs[option.product]?.find(([category, label]) =>
      category === option.category && label === option.group);
    if (group && !group[2].some((item) => item.name.toLowerCase() === option.name.toLowerCase())) {
      group[2].push({ name: option.name, price: "", custom: true });
      if (option.product === "workstation" && option.category === "ssd"
        && !SSD1_OPTIONS.some((item) => item.name === option.name)) {
        SSD1_OPTIONS.push(group[2][group[2].length - 1]);
      }
    }
  }
  for (const [category, , items] of catalogs.aio) {
    AIO_OPTIONS[category] = items.map((item) => item.name);
  }
}
