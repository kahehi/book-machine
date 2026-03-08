/**
 * Provider: Image Client Interface
 * Abstraction for image generation providers
 */

export interface ImageGenerationOptions {
  size?: string;
  quality?: string;
  style?: string;
}

export interface ImageClient {
  generate(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<string>; // returns URL
}
