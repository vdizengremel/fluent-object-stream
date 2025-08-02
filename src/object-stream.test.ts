import { ObjectStream, GroupingByKey } from '.'
import { Readable, Transform, TransformCallback } from 'stream'
import { setTimeout as wait } from 'timers/promises'
import fs from 'fs'
import Path from 'path'
import StreamError from './stream-error'

describe('ObjectStream', () => {
  function createObjectStreamFromArray<T>(array: T[]): ObjectStream<T> {
    const readable = Readable.from(array)
    return ObjectStream.ofReadable<T>(readable)
  }

  describe('#toArray', () => {
    it('should convert stream to array', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2])

      expect(await objectStream.toArray()).toEqual([1, 2])
    })
  })

  describe('#map', () => {
    it('should stream mapped data', async () => {
      const testArray: TestObject[] = [
        {
          type: '1',
          value: 2,
        },
        {
          type: '2',
          value: 4,
        },
      ]

      const objectStream: ObjectStream<TestObject> = createObjectStreamFromArray(testArray)

      const resultStream = objectStream.map((value) => value.type)
      expect(await resultStream.toArray()).toEqual(['1', '2'])
    })

    it('should reject on final operation if an error occurs during map', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const resultStream = objectStream.map(() => {
        throw new Error('Error during map')
      })

      await expect(resultStream.toArray()).rejects.toEqual(new Error('Error during map'))
    })
  })

  describe('#mapAsync', () => {
    it('should map data asynchronously', async () => {
      const testArray: TestObject[] = [
        {
          type: '1',
          value: 2,
        },
        {
          type: '2',
          value: 4,
        },
      ]

      const objectStream: ObjectStream<TestObject> = createObjectStreamFromArray(testArray)

      const resultStream = objectStream.mapAsync(async (value) => {
        await wait(10)
        return value.type
      })
      expect(await resultStream.toArray()).toEqual(['1', '2'])
    })

    it('should reject on final operation if a rejection occurs during map', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const resultStream = objectStream.mapAsync(() => {
        return Promise.reject(new Error('Error during map'))
      })

      await expect(resultStream.toArray()).rejects.toEqual(new Error('Error during map'))
    })
  })

  describe('#flatMap', () => {
    it('should flat resulting array of transform function into multiple values in stream ', async () => {
      const testArray: TestObject[][] = [
        [
          {
            type: '1',
            value: 1,
          },
          {
            type: '2',
            value: 2,
          },
        ],
        [
          {
            type: '1',
            value: 3,
          },
        ],
      ]

      const objectStream: ObjectStream<TestObject[]> = createObjectStreamFromArray(testArray)

      const resultStream = objectStream.flatMap((value) => value)
      expect(await resultStream.toArray()).toEqual([
        {
          type: '1',
          value: 1,
        },
        {
          type: '2',
          value: 2,
        },
        {
          type: '1',
          value: 3,
        },
      ])
    })
  })

  describe('#flatMapAsync', () => {
    it('should flat resolving array of transform function into multiple values in stream ', async () => {
      const testArray: TestObject[][] = [
        [
          {
            type: '1',
            value: 1,
          },
          {
            type: '2',
            value: 2,
          },
        ],
        [
          {
            type: '1',
            value: 3,
          },
        ],
      ]

      const objectStream: ObjectStream<TestObject[]> = createObjectStreamFromArray(testArray)

      const resultStream = objectStream.flatMapAsync(async (value) => {
        await wait(10)
        return value
      })

      expect(await resultStream.toArray()).toEqual([
        {
          type: '1',
          value: 1,
        },
        {
          type: '2',
          value: 2,
        },
        {
          type: '1',
          value: 3,
        },
      ])
    })
  })

  describe('#filter', () => {
    it('should filter stream with simple predicate', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const resultStream = objectStream.filter((value) => value === 2)
      expect(await resultStream.toArray()).toEqual([2])
    })

    it('should filter stream with predicate that determine type', async () => {
      const objectStream: ObjectStream<number | undefined> = createObjectStreamFromArray([1, undefined, 3])

      const resultStream: ObjectStream<number> = objectStream.filter((value): value is number => !!value)
      expect(await resultStream.toArray()).toEqual([1, 3])
    })

    it('should reject on final operation if an error occurs during filter', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const resultStream = objectStream.filter((value): value is number => {
        throw new Error('Error during filter')
      })

      await expect(resultStream.toArray()).rejects.toEqual(new Error('Error during filter'))
    })
  })

  describe('#groupByChunk', () => {
    it('should group data by chunk size', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const chunkSize = 2
      const resultStream = objectStream.groupByChunk(chunkSize)
      expect(await resultStream.toArray()).toEqual([[1, 2], [3]])
    })
  })

  describe('#groupByKey', () => {
    it('should group data according by parameter method', async () => {
      const testArray: TestObject[] = [
        {
          type: '1',
          value: 2,
        },
        {
          type: '1',
          value: 3,
        },
        {
          type: '2',
          value: 4,
        },
      ]
      const objectStream: ObjectStream<TestObject> = createObjectStreamFromArray(testArray)

      const resultStream = objectStream.groupByKey((value) => value.type)
      expect(await resultStream.toArray()).toEqual<GroupingByKey<TestObject>[]>([
        {
          key: '1',
          groupedValues: [
            {
              type: '1',
              value: 2,
            },
            {
              type: '1',
              value: 3,
            },
          ],
        },
        {
          key: '2',
          groupedValues: [
            {
              type: '2',
              value: 4,
            },
          ],
        },
      ])
    })

    it('should reject on final operation if an error occurs during groupByKey', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const resultStream = objectStream.groupByKey(() => {
        throw new Error('Error during groupByKey')
      })

      await expect(resultStream.toArray()).rejects.toEqual(new Error('Error during groupByKey'))
    })

    it('should stay empty when empty stream', async () => {
      const streamUtils: ObjectStream<TestObject> = ObjectStream.ofReadable(Readable.from([]))

      const resultStream = streamUtils.groupByKey((testObject) => testObject.type)

      const array = await resultStream.toArray()
      expect(array.length).toEqual(0)
    })
  })

  describe('#forEach', () => {
    it('should allow operation for each element', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])
      const arr: number[] = []
      await objectStream.forEach((value) => {
        arr.push(value)
      })
      expect(arr).toEqual([1, 2, 3])
    })

    it('should allow async operation for each element', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])
      const arr: number[] = []
      await objectStream.forEach((value) => asyncOperation(value, arr))
      expect(arr).toEqual([1, 2, 3])
    })

    it('should reject error if an error occurs', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const promise = objectStream.forEach(() => {
        throw new Error('Error during for each')
      })

      await expect(promise).rejects.toEqual(new Error('Error during for each'))
    })

    it('should reject error if a rejection occurs', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const promise = objectStream.forEach(() => Promise.reject(new Error('Error during for each')))

      await expect(promise).rejects.toEqual(new Error('Error during for each'))
    })

    it('should reject a stream error if the occurred error is not from error type', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const promise = objectStream.forEach(() => {
        throw 'Not a real error'
      })

      await expect(promise).rejects.toBeInstanceOf(StreamError)

      await promise.catch((err) => {
        expect(err).toHaveProperty('cause', 'Not a real error')
      })
    })

    async function asyncOperation(value: number, arr: number[]) {
      await wait(10)
      arr.push(value)
    }
  })

  describe('#writeTo', () => {
    const path = Path.join(__dirname, 'data.txt')

    afterEach(() => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(path)
    })

    it('should write stream to given destination', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const writeDestination = fs.createWriteStream(path, { encoding: 'utf8' })

      await objectStream.writeTo(writeDestination)

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const content = fs.readFileSync(path)
      expect(content.toString()).toEqual('123')
    })
  })

  describe('#transformWith', () => {
    const passThrough = (value: string, pushData: (data: string) => void) => {
      pushData(value)
    }

    it('should transform data according to given function', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])

      const duplicateAllValues = (value: string, pushData: (data: string) => void) => {
        pushData(value)
        pushData(value)
      }

      const transformed = objectStream.transformWith({ transformElement: duplicateAllValues })

      const streamContent = await transformed.toArray()
      expect(streamContent).toEqual(['1', '1', '2', '2', '3', '3'])
    })

    it('should add data at end according to given function', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])

      const addValueAtEnd = (pushData: (data: string) => void) => pushData('4')
      const transformed = objectStream.transformWith({ transformElement: passThrough, onEnd: addValueAtEnd })

      const streamContent = await transformed.toArray()
      expect(streamContent).toEqual(['1', '2', '3', '4'])
    })

    it('should reject when error during data transformation', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])
      const error = new Error('Error')
      const transformed = objectStream.transformWith({
        transformElement: () => {
          throw error
        },
      })

      await expect(transformed.toArray()).rejects.toEqual(error)
    })

    it('should reject when error at end', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])
      const error = new Error('Error')

      const transformed = objectStream.transformWith({
        transformElement: passThrough,
        onEnd: () => {
          throw error
        },
      })

      await expect(transformed.toArray()).rejects.toEqual(error)
    })

    it('should reject a stream error if the occurred error during transform is not from error type', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const transformed = objectStream.transformWith({
        transformElement: () => {
          throw 'Not a real error'
        },
      })

      const promise = transformed.toArray()

      await expect(promise).rejects.toBeInstanceOf(StreamError)

      await promise.catch((err) => {
        expect(err).toHaveProperty('cause', 'Not a real error')
      })
    })

    it('should reject a stream error if the occurred error during end is not from error type', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])

      const transformed = objectStream.transformWith({
        transformElement: passThrough,
        onEnd: () => {
          throw 'Not a real error'
        },
      })

      const promise = transformed.toArray()

      await expect(promise).rejects.toBeInstanceOf(StreamError)

      await promise.catch((err) => {
        expect(err).toHaveProperty('cause', 'Not a real error')
      })
    })
  })

  describe('#applyTransform', () => {
    it('should execute added transform on terminal operation', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])
      const doubleValueTransform = new Transform({
        objectMode: true,
        transform(chunk: number, encoding: BufferEncoding, callback: TransformCallback) {
          callback(null, chunk * 2)
        },
      })

      const objectStreamWithTransform: ObjectStream<number> = objectStream.applyTransform<number>(doubleValueTransform)

      expect(await objectStreamWithTransform.toArray()).toEqual([2, 4, 6])
    })
  })

  describe('to avoid increasing memory usage', () => {
    const DEFAULT_HIGH_WATER_MARK = 16

    it('should process data chunk by chunk', async () => {
      const array = generateRangeFrom1To(100)
      const objectStream: ObjectStream<number> = ObjectStream.ofReadable(Readable.from(array))

      let mapCallNumber = 0
      let forEachCallNumber = 0

      const orderedCalled: string[] = []
      const chunkSize = 10
      await objectStream
        .map((value) => {
          mapCallNumber++
          orderedCalled.push(`map${mapCallNumber}`)
          return value
        })
        .groupByChunk(chunkSize)
        .forEach(async () => {
          await wait(20)
          forEachCallNumber++
          orderedCalled.push(`forEach${forEachCallNumber}`)
        })

      const numberOfOperationAfterGroupByChunk = 2 // include group by chunk
      const nextDataToLoadAfterFirstForEach =
        chunkSize * numberOfOperationAfterGroupByChunk + DEFAULT_HIGH_WATER_MARK + 1
      expect(orderedCalled.indexOf(`map${nextDataToLoadAfterFirstForEach}`)).toBeGreaterThan(
        orderedCalled.indexOf('forEach1')
      )

      const nextDataToLoadAfterSecondForEach = nextDataToLoadAfterFirstForEach + chunkSize

      expect(orderedCalled.indexOf(`map${nextDataToLoadAfterSecondForEach}`)).toBeGreaterThan(
        orderedCalled.indexOf('forEach2')
      )
    })

    it('should process grouped data chunk by chunk', async () => {
      const groupSize = 10
      const array: TestObject[] = generateRangeFrom1To(100).map((value) => {
        const decade = Math.ceil(value / groupSize) * groupSize
        return {
          type: `${decade}`,
          value,
        }
      })

      const streamUtils: ObjectStream<TestObject> = ObjectStream.ofReadable(Readable.from(array))

      let mapCallNumber = 0
      let forEachCallNumber = 0

      const orderedCalled: string[] = []

      await streamUtils
        .map((value) => {
          mapCallNumber++
          orderedCalled.push(`map${mapCallNumber}`)
          return value
        })
        .groupByKey((value) => {
          return value.type
        })
        .forEach(async () => {
          await wait(30)
          forEachCallNumber++
          orderedCalled.push(`forEach${forEachCallNumber}`)
        })

      const numberOfOperationAfterGroupBy = 2 // include group by
      const nextDataToLoadAfterFirstForEach = groupSize * numberOfOperationAfterGroupBy + DEFAULT_HIGH_WATER_MARK + 2
      expect(orderedCalled.indexOf(`map${nextDataToLoadAfterFirstForEach}`)).toBeGreaterThan(
        orderedCalled.indexOf('forEach1')
      )

      const nextDataToLoadAfterSecondForEach = nextDataToLoadAfterFirstForEach + groupSize

      expect(orderedCalled.indexOf(`map${nextDataToLoadAfterSecondForEach}`)).toBeGreaterThan(
        orderedCalled.indexOf('forEach2')
      )
    })

    it('should process grouped data chunk by chunk even for further operations', async () => {
      const groupSize = 10
      const array: TestObject[] = generateRangeFrom1To(100).map((value) => {
        const decade = Math.ceil(value / groupSize) * groupSize
        return {
          type: `${decade}`,
          value,
        }
      })

      const streamUtils: ObjectStream<TestObject> = ObjectStream.ofReadable(Readable.from(array))

      let mapAfterGroupByChunkCallNumber = 0
      let forEachCallNumber = 0

      const orderedCalled: string[] = []

      await streamUtils
        .groupByKey((value) => {
          return value.type
        })
        .map((value) => {
          mapAfterGroupByChunkCallNumber++
          orderedCalled.push(`mapAfterGroupByChunk${mapAfterGroupByChunkCallNumber}`)
          return value
        })
        .forEach(async () => {
          await wait(30)
          forEachCallNumber++
          orderedCalled.push(`forEach${forEachCallNumber}`)
        })

      expect(orderedCalled.indexOf('mapAfterGroupByChunk3')).toBeGreaterThan(orderedCalled.indexOf('forEach1'))

      expect(orderedCalled.indexOf('mapAfterGroupByChunk4')).toBeGreaterThan(orderedCalled.indexOf('forEach2'))
    })

    function generateRangeFrom1To(limit: number): number[] {
      const array: number[] = []

      for (let i = 1; i <= limit; i++) {
        array.push(i)
      }

      return array
    }
  })
})

interface TestObject {
  type: string
  value: number
}
