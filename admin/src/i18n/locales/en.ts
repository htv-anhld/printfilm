import { deepMergeMessages } from "./deepMerge";
import { enExtra } from "./en/extra";
import { enCommon } from "./en/common";
import { enLabels } from "./en/labels";
import { enUsers } from "./en/users";
import { enOrders } from "./en/orders";
import { enFinance } from "./en/finance";
import { enProjects } from "./en/projects";
import { enWorks } from "./en/works";
import { enTasks } from "./en/tasks";
import { enTemplates } from "./en/templates";
import { enDrama } from "./en/drama";
import { enDashboard } from "./en/dashboard";
import { enSettings } from "./en/settings";
import { enCommerce } from "./en/commerce";
import { enUi } from "./en/ui";

export const en = deepMergeMessages({
  ...enCommon,
  labels: enLabels,
  users: enUsers,
  orders: enOrders,
  finance: enFinance,
  projects: enProjects,
  works: enWorks,
  tasks: enTasks,
  templates: enTemplates,
  drama: enDrama,
  dashboard: enDashboard,
  settings: enSettings,
  commerce: enCommerce,
  ui: enUi,
}, enExtra);
