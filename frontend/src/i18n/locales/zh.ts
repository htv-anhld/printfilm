import { zhDrama } from './zh/drama'
import { zhEpisode } from './zh/episode'
import { zhLib } from './zh/lib'
import { zhPages } from './zh/pages'
import { zhShell } from './zh/shell'
import { zhStudio } from './zh/studio'

export const zh = {
  ...zhShell,
  ...zhPages,
  studio: zhStudio,
  episode: zhEpisode,
  drama: zhDrama,
  lib: zhLib,
}
