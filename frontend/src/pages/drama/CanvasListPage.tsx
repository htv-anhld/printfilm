import DramaListPage from './DramaListPage'

/**
 * 自由画布一级入口；工作区权限与项目管理沿用共享列表。
 * 未开启 Prismreel Studio 时项目画布由 CanvasRoute 回退到本分支旧画布，列表仍需可达：
 * 否则 /drama「Canvas tự do」新建的画布项目在剧本列表里被过滤，又被重定向离开 /canvas，创建后再也找不到。
 */
export default function CanvasListPage() {
  return <DramaListPage workflow="canvas" />
}
