export default interface ObjectStreamOptions {
  /*
  Number of object in memory in each operation of the stream. See {@link https://nodejs.org/api/stream.html} for further information.
   */
  highWaterMark?: number
}
