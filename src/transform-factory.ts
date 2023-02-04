import { Transform } from 'stream'
import { ObjectTransform, ObjectStreamOptions } from '.'
import StreamError from './stream-error'

/**
 * Utility function to create {@link Transform} stream. It handles error to propagate them.
 *
 * @param objectTransform {@link ObjectTransform} representing the transformation to apply.
 * @param options options to create the {@link Transform} stream.
 * @return the created {@link Transform} stream.
 */
export function createTransform<T, R>(
  objectTransform: ObjectTransform<T, R>,
  options?: ObjectStreamOptions
): Transform {
  return new Transform({
    objectMode: true,
    highWaterMark: options?.highWaterMark,
    transform: async function (value, encoding, callback) {
      try {
        await objectTransform.transformElement(value, (data) => this.push(data))
        callback()
      } catch (e) {
        if (e instanceof Error) callback(e)
        else callback(new StreamError(e))
      }
    },
    flush(callback) {
      try {
        objectTransform.onEnd?.((data) => this.push(data))
        callback()
      } catch (e) {
        if (e instanceof Error) callback(e)
        else callback(new StreamError(e))
      }
    },
  })
}
