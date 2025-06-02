import { dag, object, func } from "@dagger.io/dagger"

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
  ): Promise<string> {
    const base = baseUrl || "https://rickrollworker.lizziepika.workers.dev"
    const slug = this.createSlug(query)
    const fullUrl = `${base.replace(/\/$/, '')}/${slug}`
    
    // Create environment with the query and URL
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
    
    return work.env().output("completed").asString()
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
    
    return work.env().output("completed").asString()
  }

  /**
   * Create a URL-safe slug from a string
   */
  private createSlug(input: string): string {
    return input
      .toLowerCase()
      .trim()
      // Replace spaces and special characters with hyphens
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length to reasonable size
      .substring(0, 50)
  }
}