import { viCommon } from "./vi/common";
import { viLabels } from "./vi/labels";
import { viUsers } from "./vi/users";
import { viOrders } from "./vi/orders";
import { viFinance } from "./vi/finance";
import { viProjects } from "./vi/projects";
import { viWorks } from "./vi/works";
import { viTasks } from "./vi/tasks";
import { viTemplates } from "./vi/templates";
import { viDrama } from "./vi/drama";
import { viDashboard } from "./vi/dashboard";
import { viSettings } from "./vi/settings";
import { viCommerce } from "./vi/commerce";

export const vi = {
  ...viCommon,
  labels: viLabels,
  users: viUsers,
  orders: viOrders,
  finance: viFinance,
  projects: viProjects,
  works: viWorks,
  tasks: viTasks,
  templates: viTemplates,
  drama: viDrama,
  dashboard: viDashboard,
  settings: viSettings,
  commerce: viCommerce,
};
