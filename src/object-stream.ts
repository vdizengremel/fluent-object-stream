import { Readable, Transform, Writable } from 'stream'
import { pipeline } from 'stream/promises'
import { createTransform, ObjectTransform, ObjectStreamOptions, StreamError } from '.'

/**
 * This is a class to facilitate the transformation of data in a stream. The generic type represent the type of the data in the stream.
 * All methods allow to keep a strongly typed system.
 */
export default class ObjectStream<T> {
  private constructor(
    private readonly stream: Readable,
    private readonly intermediateOperations: Transform[] = [],
    private readonly options?: ObjectStreamOptions
  ) {}

  static ofReadable<T>(readable: Readable): ObjectStream<T> {
    return new ObjectStream<T>(readable)
  }

  /**
   * Returns an {@link ObjectStream} consisting of the results of applying the given function to each element of this stream.
   * To use an async function, see {@link mapAsync} instead.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param mapFn Function that is called for every element of the stream.
   * The mapFn function accepts one argument which is the current element processed in the stream.
   * @return the new {@link ObjectStream}.
   */
  public map<R>(mapFn: (value: T) => R): ObjectStream<R> {
    return this.transformWith({
      transformElement: (value, pushData) => {
        const mappedValue = mapFn(value)
        pushData(mappedValue)
      },
    })
  }

  /**
   * Returns an {@link ObjectStream} consisting of the results of resolving the given function to each element of this stream.
   * To use a sync operation, see {@link map} instead.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param mapFn Function that is called for every element of the stream to transform each element with the resolve value af this function.
   * The mapFn function accepts one argument which is the current element processed in the stream.
   * @return the new {@link ObjectStream}.
   */
  public mapAsync<R>(mapFn: (value: T) => Promise<R>): ObjectStream<R> {
    return this.transformWith({
      transformElement: async (value, pushData) => {
        const mappedValue = await mapFn(value)
        pushData(mappedValue)
      },
    })
  }

  /**
   * Returns an {@link ObjectStream} consisting of replacing each element by all the elements of the array returned by the mapFn.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param mapFn Function that is called for every element of the stream. Each time mapFn executes, all the element in the returned array are pushed to the result stream.
   * The mapFn function accepts one argument which is the current element processed in the stream.
   * @return the new {@link ObjectStream}.
   */
  public flatMap<R>(mapFn: (value: T) => R[]): ObjectStream<R> {
    return this.transformWith({
      transformElement: (value, pushData) => {
        const mappedArrayValue = mapFn(value)
        mappedArrayValue.forEach(pushData)
      },
    })
  }

  /**
   * Returns an {@link ObjectStream} consisting of replacing each element by all the elements of the array resolved by the mapFn.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param mapFn Function that is called for every element of the stream. Each time mapFn executes, all the element in the resolved array are pushed to the result stream.
   * The mapFn function accepts one argument which is the current element processed in the stream.
   * @return the new {@link ObjectStream}.
   */
  public flatMapAsync<R>(mapFn: (value: T) => Promise<R[]>): ObjectStream<R> {
    return this.transformWith({
      transformElement: async (value, pushData) => {
        const mappedArrayValue = await mapFn(value)
        mappedArrayValue.forEach(pushData)
      },
    })
  }

  /**
   * Returns an {@link ObjectStream} consisting of the elements that pass the test implemented by the provided filterFn.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param filterFn Function that is a predicate, to test each element of the stream. Return a value that coerces to true to keep the element, or to false otherwise.
   * It accepts one argument which is the element processed in the stream.
   * @return the new {@link ObjectStream}.
   */
  public filter<S extends T>(filterFn: ((value: T) => value is S) | ((value: T) => boolean)): ObjectStream<S> {
    return this.transformWith({
      transformElement: (value, pushData) => {
        if (filterFn(value)) {
          pushData(value as S)
        }
      },
    })
  }

  /**
   * Returns an {@link ObjectStream} consisting of elements grouped by the result of getKeyFn.
   * Each time the getKeyFn returns a different key, it considers the group is complete and push it to the result stream.
   * This means for the result to be accurate your stream needs to be ordered by your key first or else you will have multiple {@link GroupingByKey} for the same key.
   * This behaviour is to avoid loading all data into memory.
   *
   * <strong>NOTE</strong> : If a lot of elements are in the same group, that means that all these elements will be into memory.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param getKeyFn Function that is called for each element to know if current element should be grouped with the previous one.
   * @return the new {@link ObjectStream}.
   */
  public groupByKey(getKeyFn: (value: T) => string): ObjectStream<GroupingByKey<T>> {
    let currentGroupingByKey: GroupingByKey<T> | undefined

    return this.transformWith(
      {
        transformElement: (value, pushData) => {
          const key = getKeyFn(value)

          if (key !== currentGroupingByKey?.key) {
            if (currentGroupingByKey) {
              pushData(currentGroupingByKey)
            }

            currentGroupingByKey = {
              key: key,
              groupedValues: [],
            }
          }

          currentGroupingByKey.groupedValues.push(value)
        },
        onEnd: (pushData) => {
          if (currentGroupingByKey) {
            pushData(currentGroupingByKey)
          }
        },
      },
      {
        highWaterMark: 1,
      }
    )
  }

  /**
   * Returns an {@link ObjectStream} consisting of an array of elements whose size depends on chunkSize.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param chunkSize size of the chunks
   * @return the new {@link ObjectStream}.
   */
  public groupByChunk(chunkSize: number): ObjectStream<T[]> {
    let chunkArray: T[] = []

    return this.transformWith(
      {
        transformElement: (value, pushData) => {
          chunkArray.push(value)

          if (chunkArray.length >= chunkSize) {
            pushData(chunkArray)
            chunkArray = []
          }
        },
        onEnd: (pushData) => {
          if (chunkArray.length > 0) {
            pushData(chunkArray)
          }
        },
      },
      {
        highWaterMark: 1,
      }
    )
  }

  /**
   * Returns an {@link ObjectStream} consisting of the elements pushed in the given parameter.
   * This method is to add a generic operation in case none of the existing ones correspond to your needs.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param objectTransform {@link ObjectTransform} which represents the transformation to apply.
   * @param options {@link ObjectStreamOptions} to override for current and next operation.
   * @return the new {@link ObjectStream}.
   */
  public transformWith<R>(objectTransform: ObjectTransform<T, R>, options?: ObjectStreamOptions): ObjectStream<R> {
    const transform = createTransform(objectTransform, { ...this.options, ...options })

    return this.applyTransform(transform, options)
  }

  /**
   * Returns an {@link ObjectStream} consisting of the elements transformed by the given Transform parameter.
   * <p>
   *  This is an <strong>intermediate operation</strong>.
   * <p/>
   * @param transform which is a {@link Transform}.
   * @param options {@link ObjectStreamOptions} to override for next operations
   * @return the new {@link ObjectStream}.
   */
  public applyTransform<R>(transform: Transform, options: ObjectStreamOptions = {}): ObjectStream<R> {
    return new ObjectStream(this.stream, [...this.intermediateOperations, transform], { ...this.options, ...options })
  }

  /**
   * Return all the elements of the stream in an array.
   * <p>
   *  This is a <strong>terminal operation</strong>.
   * <p/>
   * @return a Promise which is
   * - resolved once all the stream is processed with an array containing all the elements of the stream
   * - or rejected with the error raised during the processing of the stream if there is one.
   */
  public async toArray(): Promise<T[]> {
    const array: T[] = []
    await this.forEach((value) => {
      array.push(value)
    })

    return array
  }

  /**
   * Apply the given function to each element of the stream before closing it.
   * <p>
   *  This is a <strong>terminal operation</strong>.
   * <p/>
   * @param fn Function that is called for each element of the stream. It can be an async function.
   * @return a Promise which is
   * - resolved once all the stream is processed
   * - or rejected with the error raised during the processing of the stream if there is one.
   */
  async forEach(fn: (value: T) => void | Promise<void>): Promise<void> {
    const forEachStream = new Writable({
      objectMode: true,
      highWaterMark: this.options?.highWaterMark,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      write: async (value: T, encoding: BufferEncoding, callback: (error?: Error | null) => void): Promise<void> => {
        try {
          await fn(value)
          callback()
        } catch (e) {
          if (e instanceof Error) callback(e)
          else callback(new StreamError(e))
        }
      },
    })

    await this.writeTo(forEachStream)
  }

  /**
   * Pass each element to the writable stream.
   * <p>
   *  This is a <strong>terminal operation</strong>.
   * <p/>
   * @param writable Writable stream to write data to their destination.
   * @return a Promise which is
   * - resolved once all the stream is processed
   * - or rejected with the error raised during the processing of the stream if there is one.
   */
  async writeTo(writable: Writable): Promise<void> {
    await pipeline([this.stream, ...this.intermediateOperations, writable])
  }
}

export interface GroupingByKey<T> {
  key: string
  groupedValues: T[]
}
