export const zhFinance = {
  desc: "按日汇总本地扣费、成本与官方实际成本，计算利润",
  loadFailed: "财务列表加载失败",
  refreshed: "官方成本已刷新",
  refresh: "刷新官方成本",
  rangeMismatch: "数据与当前时间范围不一致，请重新加载",
  configuredDesc: "近 {n} 日 · 实际成本来自 TokenFree New API",
  notConfigured: "未配置 TokenFree API Key，实际成本列为空；请在「系统设置 → 模型」填写后刷新",
  cols: {
    date: "日期",
    charge: "本地扣费",
    cost: "本地成本",
    actualCost: "实际成本",
    profit: "利润",
  },
};
