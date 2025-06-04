import { dag, object, func, Secret } from "@dagger.io/dagger"

@object()
export class UrlSlugAgent {
  /**
   * Generate a podcast and return an LLM response with URL
   */
  @func()
  async generatePodcast(
    /**
     * The podcast topic/query, e.g. "artificial intelligence in healthcare"
     */
    query: string,
    /**
     * Base Cloudflare Worker URL (optional, defaults to example URL)
     */
    baseUrl?: string,
    /**
     * Cloudflare Account ID (optional - only needed for database saving)
     */
    cloudflareAccountId?: Secret,
     /**
     * Cloudflare D1 Database ID (optional - only needed for database saving)
     */
    cloudflareDatabaseId?: Secret,
    /**
     * Cloudflare API Token (optional - only needed for database saving)
     */
    cloudflareApiToken?: Secret
  ): Promise<string> {
    const base = baseUrl || "https://rickrollworker.lizziepika.workers.dev"
    
    // Generate LLM slug using a different approach
    const slug = await this.generateLLMSlug(query)
    const fullUrl = `${base.replace(/\/$/, '')}/${slug}`
    
    // Create environment with the query and the generated URL
    const environment = dag
      .env()
      .withStringInput("query", query, "the podcast topic")
      .withStringInput("url", fullUrl, "the generated podcast URL")
    
    // Use LLM to generate podcast response
    const work = dag
      .llm()
      .withEnv(environment)
      .withPrompt(
        `You are an enthusiastic podcast producer who just created an amazing new podcast episode.
        
        A user requested a podcast about: $query
        The podcast has been generated and is available at: $url
        
        Write an exciting, friendly response (2-3 sentences) telling them their podcast is ready.
        Use an upbeat tone and mention the topic specifically.
        Include the URL in your response.
        
        Example format: "Great! Your podcast about [topic] has been generated and is ready to listen! Check it out at [URL] - I think you'll love the insights we covered!"
        
        Make it sound natural and engaging, not robotic.`
      )
    
    const llmResponse = await work.sync().toString()

    // Save to D1 database only if all secrets are provided
    if (cloudflareAccountId && cloudflareDatabaseId && cloudflareApiToken) {
      await this.savePodcastToD1(query, slug, fullUrl, cloudflareAccountId, cloudflareDatabaseId, cloudflareApiToken)
    }

    return llmResponse
  }

  /**
   * Generate LLM-based slug with fallback
   */
  private async generateLLMSlug(query: string): Promise<string> {
    try {
      // Use LLM to generate a unique, SEO-friendly slug
      const slugEnvironment = dag
        .env()
        .withStringInput("topic", query, "the podcast topic")
      
      const slugWork = dag
        .llm()
        .withEnv(slugEnvironment)
        .withPrompt(
          `Generate a unique, SEO-friendly URL slug for a podcast about: $topic
          
          Requirements:
          - Use only lowercase letters, numbers, and hyphens
          - Make it descriptive and memorable
          - Keep it between 3-8 words
          - Avoid generic words like "podcast", "episode", "show"
          - Make it specific to the topic
          
          Examples:
          - For "artificial intelligence in healthcare": "ai-transforms-medical-diagnosis"
          - For "sustainable energy solutions": "clean-power-future-tech"
          - For "space exploration": "mars-mission-breakthrough"
          - For "shoes": "footwear-fashion-trends"
          - For "Starbucks": "coffee-culture-deep-dive"
          
          Return ONLY the slug, nothing else.`
        )
      
      const rawSlug = await slugWork.sync().toString()
      const cleanedSlug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
      
      // If LLM returned a valid slug, use it; otherwise fall back to manual method
      if (cleanedSlug.length > 0 && cleanedSlug !== 'objectpromise') {
        return cleanedSlug
      } else {
        return this.createSlug(query)
      }
    } catch (error) {
      // Fall back to manual slug generation if LLM fails
      return this.createSlug(query)
    }
  }

  /**
   * Generate a podcast series with episode number
   */
  @func()
  async generatePodcastEpisode(
    /**
     * The podcast topic/query
     */
    query: string,
    /**
     * Episode number
     */
    episode: number,
    /**
     * Base Cloudflare Worker URL (optional)
     */
    baseUrl?: string,
    /**
     * Cloudflare Account ID (optional - only needed for database saving)
     */
    cloudflareAccountId?: Secret,
    /**
     * Cloudflare D1 Database ID (optional - only needed for database saving)
     */
    cloudflareDatabaseId?: Secret,
    /**
     * Cloudflare API Token (optional - only needed for database saving)
     */
    cloudflareApiToken?: Secret
  ): Promise<string> {
    const base = baseUrl || "https://rickrollworker.lizziepika.workers.dev"
    const baseSlug = this.createSlug(query)
    const slug = `${baseSlug}-episode-${episode}`
    const fullUrl = `${base.replace(/\/$/, '')}/${slug}`
    
    // Create environment with the query, episode, and URL
    const environment = dag
      .env()
      .withStringInput("query", query, "the podcast topic")
      .withStringInput("episode", episode.toString(), "the episode number")
      .withStringInput("url", fullUrl, "the generated podcast URL")
    
    // Use LLM to generate episode-specific response
    const work = dag
      .llm()
      .withEnv(environment)
      .withPrompt(
        `You are a podcast producer announcing a new episode in a series.
        
        Topic: $query
        Episode Number: $episode
        URL: $url
        
        Write an exciting announcement (2-3 sentences) for this specific episode.
        Mention it's episode $episode and include the topic.
        Include the URL where they can listen.
        Make it sound like part of an ongoing series.
        
        Example: "Episode $episode of your podcast series about $query is now live! This episode dives deep into [specific aspect]. Listen now at $url"`
      )
    
    const llmResponse = await work.sync().toString()
    
    // Save to D1 database only if all secrets are provided
    if (cloudflareAccountId && cloudflareDatabaseId && cloudflareApiToken) {
      await this.savePodcastToD1(query, slug, fullUrl, cloudflareAccountId, cloudflareDatabaseId, cloudflareApiToken)
    }
    
    return llmResponse
  }

  /**
   * Generate just the slug from user query
   */
  @func()
  generateSlug(
    /**
     * The user query to convert to a slug
     */
    query: string,
  ): string {
    return this.createSlug(query)
  }

  /**
   * Generate URL without LLM response
   */
  @func()
  async generateUrl(
    /**
     * The user query to convert to a slug
     */
    query: string,
    /**
     * Base Cloudflare Worker URL (optional)
     */
    baseUrl?: string,
  ): Promise<string> {
    const base = baseUrl || "https://rickrollworker.lizziepika.workers.dev"
    const slug = this.createSlug(query)
    const fullUrl = `${base.replace(/\/$/, '')}/${slug}`
    
    return fullUrl
  }

  /**
   * Save podcast information to Cloudflare D1 database
   */
  private async savePodcastToD1(
    topic: string,
    slug: string,
    url: string,
    accountId: Secret,
    databaseId: Secret,
    apiToken: Secret
  ): Promise<void> {
    try {
      // Escape quotes in the data for JSON
      const escapedTopic = topic.replace(/"/g, '\\"')
      const escapedSlug = slug.replace(/"/g, '\\"')
      const escapedUrl = url.replace(/"/g, '\\"')
      const createdAt = new Date().toISOString()
      
      // Use container with curl to call D1 REST API, following Dagger docs pattern
      await dag
        .container()
        .from("curlimages/curl:latest")
        .withSecretVariable("ACCOUNT_ID", accountId)
        .withSecretVariable("DATABASE_ID", databaseId)
        .withSecretVariable("API_TOKEN", apiToken)
        .withExec([
          "sh", "-c",
          `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query" \\
           -H "Authorization: Bearer $API_TOKEN" \\
           -H "Content-Type: application/json" \\
           -d '{"sql":"INSERT INTO podcasts (topic, slug, url, created_at) VALUES (?, ?, ?, ?)","params":["${escapedTopic}","${escapedSlug}","${escapedUrl}","${createdAt}"]}'`
        ])
        .stdout()
    } catch (error) {
      // Silently handle errors so podcast generation doesn't fail
    }
  }

  /**
   * Create a URL-safe slug from a string - enhanced version
   */
  private createSlug(input: string): string {
    // Enhanced slug generation with more complexity
    const words = input.toLowerCase().trim().split(/\s+/)
    
    // Add descriptive words based on content
    const descriptors = ['deep-dive', 'explained', 'guide', 'insights', 'stories', 'journey', 'exploration', 'breakdown']
    const randomDescriptor = descriptors[Math.floor(Math.random() * descriptors.length)]
    
    // Create a more complex slug
    let complexSlug = words
      .filter(word => word.length > 2) // Remove short words
      .slice(0, 3) // Take first 3 meaningful words
      .join('-')
    
    // Add the descriptor
    complexSlug += `-${randomDescriptor}`
    
    // Clean and format
    return complexSlug
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
  }
}