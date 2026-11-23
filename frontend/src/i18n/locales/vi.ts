import { viDrama } from './vi/drama'
import { viEpisode } from './vi/episode'
import { viLib } from './vi/lib'
import { viPages } from './vi/pages'
import { viShell } from './vi/shell'
import { viStudio } from './vi/studio'

export const vi = {
  ...viShell,
  ...viPages,
  studio: viStudio,
  episode: viEpisode,
  drama: viDrama,
  lib: viLib,
}
