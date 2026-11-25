import { deepMergeMessages } from './deepMerge'
import { zhExtra } from './zh/extra'
import { zhStudioExtra } from './zh/studio_extra'
import { zhDrama } from './zh/drama'
import { zhEpisode } from './zh/episode'
import { zhLib } from './zh/lib'
import { zhPages } from './zh/pages'
import { zhShell } from './zh/shell'
import { zhShortVideoCreate } from './zh/shortVideoCreate'
import { zhStudio } from './zh/studio'

export const zh = deepMergeMessages({
  ...zhShell,
  ...zhPages,
  shortVideoCreate: zhShortVideoCreate,
  studio: zhStudio,
  episode: zhEpisode,
  drama: zhDrama,
  lib: zhLib,
}, { ...zhExtra, ...zhStudioExtra })
