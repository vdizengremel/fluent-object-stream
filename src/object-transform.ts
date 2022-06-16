/**
 * Represents a transformation to apply to a stream.
 * The generic type T represents the type of the data to transform.
 * The generic type R represents the type of the data after transformation.
 */
export default interface ObjectTransform<T, R> {
  /**
   * Function that is called for each element of the stream.
   * @param value It is the current element processed by the stream.
   * @param pushData Function that takes in parameter the transformed value to push it in the result stream.
   */
  transformElement: (value: T, pushData: (data: R) => void) => void | Promise<void>

  /**
   * Function that is called at the end of the stream once all data have been processed.
   * @param pushData Function that takes in parameter a value to be pushed at the end of the result stream.
   */
  onEnd?: (pushData: (data: R) => void) => void
}
