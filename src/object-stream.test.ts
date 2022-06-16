import ObjectStream from './object-stream'
import { Readable } from 'stream'
import { setTimeout as wait } from 'timers/promises'
import * as fs from 'fs'
import * as Path from 'path'

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

  describe('#filter', () => {
    it('should filter stream', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const resultStream = objectStream.filter((value) => value === 2)
      expect(await resultStream.toArray()).toEqual([2])
    })

    it('should reject on final operation if an error occurs during filter', async () => {
      const objectStream: ObjectStream<number> = createObjectStreamFromArray([1, 2, 3])

      const resultStream = objectStream.filter(() => {
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
      expect(await resultStream.toArray()).toEqual([
        {
          key: '1',
          values: [
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
          values: [
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

    async function asyncOperation(value: number, arr: number[]) {
      await wait(10)
      arr.push(value)
    }
  })

  describe('#writeTo', () => {
    const path = Path.join(__dirname, 'data.txt')

    afterEach(() => {
      fs.unlinkSync(path)
    })

    it('should write stream to given destination', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])

      const writeDestination = fs.createWriteStream(path, { encoding: 'utf8' })

      await objectStream.writeTo(writeDestination)

      const content = fs.readFileSync(path)
      expect(content.toString()).toEqual('123')
    })
  })

  describe('#transformWith', () => {
    it('should transform data according to given function', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])

      const duplicateAllValues = (value: string, pushData: (data: string) => void) => {
        pushData(value)
        pushData(value)
      }

      const transformed = objectStream.transformWith(duplicateAllValues)

      const streamContent = await transformed.toArray()
      expect(streamContent).toEqual(['1', '1', '2', '2', '3', '3'])
    })

    it('should add data at end according to given function', async () => {
      const objectStream = createObjectStreamFromArray(['1', '2', '3'])

      const passThrough = (value: string, pushData: (data: string) => void) => {
        pushData(value)
      }

      const addValueAtEnd = (pushData: (data: string) => void) => pushData('4')
      const transformed = objectStream.transformWith(passThrough, addValueAtEnd)

      const streamContent = await transformed.toArray()
      expect(streamContent).toEqual(['1', '2', '3', '4'])
    })
  })
})

interface TestObject {
  type: string
  value: number
}
