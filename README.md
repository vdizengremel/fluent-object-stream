[![CI](https://github.com/vdizengremel/fluent-object-stream/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vdizengremel/fluent-object-stream/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/vdizengremel/fluent-object-stream/badge.svg?branch=main)](https://coveralls.io/github/vdizengremel/fluent-object-stream?branch=main)

# fluent-object-stream
This is a library to facilitate the transformation of object in steams while being strongly typed.
It is built on node transform streams and node pipeline to execute all transformations, handle errors and end streams correctly.

Before explaining the library in detail, here is some examples to show what it looks like.

Example of use that log adult names from a stream of persons:
```typescript
const objectStream = ObjectStream.ofReadable<Person>(readable)
await objectStream
  .filter((person) => person.isAdult()) // Still an ObjectStream<Person>
  .map((person) => person.name) // After map it becomes an ObjectStream<string>
  .forEach((personName) => console.log(personName)) // Since it is an ObjectStream<string>, personName is a string
```

Another example : suppose that your datasource does not allow stream to write data and to be efficient it needs to save 1000 elements per 1000 elements. Then the ObjectStream can help you like this :
```typescript
const objectStream = ObjectStream.ofReadable<Person>(readable)
await objectStream
    .map((person) => toPersonDto(person)) // After map it becomes an ObjectStream<PersonDto>
    .groupByChunk(1000) // After groupByChunk it becomes an ObjectStream<PersonDto[]>
    .forEach((chunk) => datasource.saveAll(chunk)) // Since it is an ObjectStream<PersonDto[]>, chunk is an array of PersonDto containing 1000 elements (except for the last call of course where it gives the remaining elemets) 
```

Want to know more ? Just continue reading ;) 

## How to start

### Installation

To install the library :
`npm install fluent-object-stream` or `yarn add fluent-object-stream`

### Instantiation
To instantiate it : `ObjectStream.ofReadable<Person>(readable)`. 
Two things to know :
- The parameter `readable` is a Readable stream (see [node documentation](https://nodejs.org/api/stream.html)).
  - You can get it from a file, a mongo database or any other datasource that allows retrieving data bit by bit.
  - Or create your own from, an iterator or async iterator, or from a database cursor for instance
- If you use typescript, the generic type (`<Person>` in this example) needs to be passed at the instantiation since it cannot guess the type of the data it will receive.
This allows the ObjectStream to be correctly type whatever the operations you will apply to it.

### Operations
#### Terminal vs intermediate operations
There are two kind of operations :
- intermediate operations : it is the operations you will chain to do what you need to do. They will not be executed until a terminal operation is asked.
- terminal operations : it is the last operation you execute on the stream. It resolves a promise with the result once all elements of the stream have been processed.
  So it runs all intermediate operations plus the final one, closes the stream and returns the result. 

Here is an example that stream persons, keep only the adults and log the person name :
```typescript
await objectStream
.filter((person) => person.isAdult()) // filter is intermediate
.map((person) => person.name) // map is intermediate
.forEach((personName) => console.log(personName)) // forEach is terminal
```

#### Terminal operations
The terminal operations are simply the methods that do not return an ObjectStream. 
They all return a promise :
- which is resolved once the stream is closed
- or rejected if one of the intermediate operation throws (or reject for the async ones) an error

Terminal operations are `forEach`, `toArray` and `writeTo`.


#### Intermediate operations
The intermediate operations are simply the methods that return an ObjectStream which allows you to chain them.
Intermediate operations are `filter`, `map`, `groupByChunk` (non exhaustive list).

If none of the existing operations match your needs, you can create your own with the `transformWith` method.
Here is an example that's duplicate all values in the stream by pushing them twice :

```typescript
import ObjectStream from './object-stream'

const objectStream = ObjectStream.ofReadable<string>(Readable.from(['1', '2', '3']))

const duplicateAllValues = (value: string, pushData: (data: string) => void) => {
  pushData(value)
  pushData(value)
}

const transformed = objectStream.transformWith({ transformElement: duplicateAllValues })

const streamContent = await transformed.toArray()
expect(streamContent).toEqual(['1', '1', '2', '2', '3', '3'])
```

Same example but with the optional `onEnd` callback that adds value to the stream after the processing of all values :
```typescript
const objectStream = ObjectStream.ofReadable<string>(Readable.from(['1', '2', '3']))

const duplicateAllValues = (value: string, pushData: (data: string) => void) => {
  pushData(value)
  pushData(value)
}

const addValuesAtEnd = (pushData: (data: string) => void) => {
  pushData('4')
  pushData('4')
}

const transformed = objectStream.transformWith({ transformElement: duplicateAllValues, onEnd: addValuesAtEnd })

const streamContent = await transformed.toArray()
expect(streamContent).toEqual(['1', '1', '2', '2', '3', '3', '4', '4'])
```

All intermediate operations use `transformWith` internally. You can look at them for further examples.

If you already have transform stream you want to reuse then you can do it with `applyTransform` method. Note you will have to specify the return type.

##### Tip about filter method
If you have code like this :

```typescript
const objectStream: ObjectStream<Child | Adult> = getStreamFromSomeWhere()
const childStream = objectStream.filter((person) => person.isChild())
```
After the filter you know that ObjectStream contains only Child and not Adult. But it stills an `ObjectStream<Child | Adult>`. So you have to tell the compiler that it is now an `ObjectStream<Child>`.
You can cast with `as` or you can write it like this :

```typescript
const objectStream: ObjectStream<Child | Adult> = getStreamFromSomeWhere()
const childStream = objectStream.filter((person): person is Child => person.isChild())
```

`childStream` is now an `ObjectStream<Child>`. Note that the way filter is type is the same as the filter method of arrays. It means filter method on arrays supports the same syntax.

#### Pass final operation to another library
You could need to pass the last operation to another library that will write data somewhere (it could be sending it to file storage or to HTTP response). This library allows you to do it like this :

```typescript
import { createTransform } from '.'

const objectStream: ObjectStream<any> = getStreamFromSomeWhere()
const transform = createTransform(/* Take a transformation operation. See documentation on this exported function from this lib. */)

// You can now pass this transform to the external lib you need to use and then write your data into it like this :
await Promise.all([
  objectStream.writeTo(transform),
  anyExternalLib.uploadStream(transform),
])
```
