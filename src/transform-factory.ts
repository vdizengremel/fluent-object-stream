import { Transform } from 'stream'
import ObjectTransform from './object-transform'

export const createTransform: <T, R>(objectTransform: ObjectTransform<T, R>) => Transform = (objectTransform) => {
  return new Transform({
    objectMode: true,

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
      objectTransform.onEnd?.((data) => this.push(data))
      callback()
    },
  })
}

class StreamError extends Error {
  constructor(public readonly cause: unknown) {
    super('Error during stream. See cause for more information.')
  }
}
