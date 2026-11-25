import { deepMergeMessages } from './deepMerge'
import { viExtra } from './vi/extra'
import { viStudioExtra } from './vi/studio_extra'
import { viDrama } from './vi/drama'
import { viEpisode } from './vi/episode'
import { viLib } from './vi/lib'
import { viPages } from './vi/pages'
import { viShell } from './vi/shell'
import { viShortVideoCreate } from './vi/shortVideoCreate'
import { viStudio } from './vi/studio'

export const vi = deepMergeMessages({
  ...viShell,
  ...viPages,
  shortVideoCreate: viShortVideoCreate,
  studio: viStudio,
  episode: viEpisode,
  drama: viDrama,
  lib: viLib,
}, { ...viExtra, ...viStudioExtra })
