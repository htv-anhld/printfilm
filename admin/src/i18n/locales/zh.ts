import { deepMergeMessages } from "./deepMerge";
import { zhExtra } from "./zh/extra";
import { zhCommon } from "./zh/common";
import { zhLabels } from "./zh/labels";
import { zhUsers } from "./zh/users";
import { zhOrders } from "./zh/orders";
import { zhFinance } from "./zh/finance";
import { zhProjects } from "./zh/projects";
import { zhWorks } from "./zh/works";
import { zhTasks } from "./zh/tasks";
import { zhTemplates } from "./zh/templates";
import { zhDrama } from "./zh/drama";
import { zhDashboard } from "./zh/dashboard";
import { zhSettings } from "./zh/settings";
import { zhCommerce } from "./zh/commerce";

export const zh = deepMergeMessages({
  ...zhCommon,
  labels: zhLabels,
  users: zhUsers,
  orders: zhOrders,
  finance: zhFinance,
  projects: zhProjects,
  works: zhWorks,
  tasks: zhTasks,
  templates: zhTemplates,
  drama: zhDrama,
  dashboard: zhDashboard,
  settings: zhSettings,
  commerce: zhCommerce,
}, zhExtra);
