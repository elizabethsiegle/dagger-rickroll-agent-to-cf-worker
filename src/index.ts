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
   * Get all previously generated podcasts from the database
   */
  @func()
  async getPreviousPodcasts(
    /**
     * Maximum number of podcasts to return (optional, defaults to 10)
     */
    limit?: number,
    /**
     * Cloudflare Account ID (optional - only needed for database access)
     */
    cloudflareAccountId?: Secret,
    /**
     * Cloudflare D1 Database ID (optional - only needed for database access)
     */
    cloudflareDatabaseId?: Secret,
    /**
     * Cloudflare API Token (optional - only needed for database access)
     */
    cloudflareApiToken?: Secret
  ): Promise<string> {
    // Check if all secrets are provided
    if (!cloudflareAccountId || !cloudflareDatabaseId || !cloudflareApiToken) {
      return "Error: Cloudflare credentials are required to access the database. Please provide all three secrets."
    }

    try {
      const maxResults = limit || 10
      
      // Query the database for recent podcasts
      const result = await dag
        .container()
        .from("curlimages/curl:latest")
        .withSecretVariable("ACCOUNT_ID", cloudflareAccountId)
        .withSecretVariable("DATABASE_ID", cloudflareDatabaseId)
        .withSecretVariable("API_TOKEN", cloudflareApiToken)
        .withExec([
          "sh", "-c",
          `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query" \\
           -H "Authorization: Bearer $API_TOKEN" \\
           -H "Content-Type: application/json" \\
           -d '{"sql":"SELECT topic, slug, url, created_at FROM podcasts ORDER BY created_at DESC LIMIT ?","params":[${maxResults}]}'`
        ])
        .stdout()

      const response = JSON.parse(result)
      
      if (response.success && response.result && response.result[0] && response.result[0].results) {
        const podcasts = response.result[0].results
        
        if (podcasts.length === 0) {
          return "No podcasts found in the database yet. Generate your first podcast to get started!"
        }
        
        // Format the results nicely
        let output = `Found ${podcasts.length} previously generated podcast(s):\n\n`
        
        podcasts.forEach((podcast: any, index: number) => {
          const date = new Date(podcast.created_at).toLocaleDateString()
          output += `${index + 1}. "${podcast.topic}"\n`
          output += `   📅 Generated: ${date}\n`
          output += `   🔗 URL: ${podcast.url}\n`
          output += `   📝 Slug: ${podcast.slug}\n\n`
        })
        
        return output
      } else {
        return "Error retrieving podcasts from database. Make sure your credentials are correct."
      }
    } catch (error) {
      return `Error querying database: ${error}`
    }
  }
  
  /**
   * Get AI-powered podcast recommendations based on your preferences
   */
  @func()
  async recommendPodcast(
    /**
     * Describe what kind of podcast you want (e.g. "I want a podcast that's happy", "I want something about AI")
     */
    preference: string,
    /**
     * Cloudflare Account ID (optional - only needed for database access)
     */
    cloudflareAccountId?: Secret,
    /**
     * Cloudflare D1 Database ID (optional - only needed for database access)
     */
    cloudflareDatabaseId?: Secret,
    /**
     * Cloudflare API Token (optional - only needed for database access)
     */
    cloudflareApiToken?: Secret
  ): Promise<string> {
    // Check if all secrets are provided
    if (!cloudflareAccountId || !cloudflareDatabaseId || !cloudflareApiToken) {
      return "Error: Cloudflare credentials are required to access the database and AI. Please provide all three secrets."
    }

    try {
      // First, get all podcasts from the database
      const dbResult = await dag
        .container()
        .from("curlimages/curl:latest")
        .withSecretVariable("ACCOUNT_ID", cloudflareAccountId)
        .withSecretVariable("DATABASE_ID", cloudflareDatabaseId)
        .withSecretVariable("API_TOKEN", cloudflareApiToken)
        .withExec([
          "sh", "-c",
          `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query" \\
           -H "Authorization: Bearer $API_TOKEN" \\
           -H "Content-Type: application/json" \\
           -d '{"sql":"SELECT topic, slug, url, created_at FROM podcasts ORDER BY created_at DESC LIMIT 50","params":[]}'`
        ])
        .stdout()

      const dbResponse = JSON.parse(dbResult)
      
      if (!dbResponse.success || !dbResponse.result || !dbResponse.result[0] || !dbResponse.result[0].results) {
        return "Error retrieving podcasts from database. Make sure your credentials are correct."
      }

      const podcasts = dbResponse.result[0].results
      
      if (podcasts.length === 0) {
        return "No podcasts found in the database yet. Generate some podcasts first to get recommendations!"
      }

      // Format podcasts list for AI
      const podcastList = podcasts.map((podcast: any, index: number) => {
        const date = new Date(podcast.created_at).toLocaleDateString()
        return `${index + 1}. Topic: "${podcast.topic}" | URL: ${podcast.url} | Created: ${date}`
      }).join('\n')

      // Escape special characters for JSON
      const escapedPreference = preference.replace(/"/g, '\\"').replace(/\n/g, '\\n')
      const escapedPodcastList = podcastList.replace(/"/g, '\\"').replace(/\n/g, '\\n')

      // Use Cloudflare Workers AI to analyze and recommend
      const aiResult = await dag
        .container()
        .from("curlimages/curl:latest")
        .withSecretVariable("ACCOUNT_ID", cloudflareAccountId)
        .withSecretVariable("API_TOKEN", cloudflareApiToken)
        .withExec([
          "sh", "-c",
          `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai/run/@cf/meta/llama-3.1-8b-instruct" \\
           -H "Authorization: Bearer $API_TOKEN" \\
           -H "Content-Type: application/json" \\
           -d '{
             "messages": [
               {
                 "role": "system", 
                 "content": "You are a helpful podcast recommendation assistant. Based on a user preference and a list of available podcasts, recommend the best matching podcast(s). Be enthusiastic and explain why your recommendation fits their request. Include the full URL in your response."
               },
               {
                 "role": "user", 
                 "content": "User preference: \\"${escapedPreference}\\"\\n\\nAvailable podcasts:\\n${escapedPodcastList}\\n\\nPlease recommend the best podcast(s) that match my preference and explain why."
               }
             ]
           }'`
        ])
        .stdout()

      const aiResponse = JSON.parse(aiResult)
      
      if (aiResponse.success && aiResponse.result && aiResponse.result.response) {
        return `🤖 AI Podcast Recommendation:\n\n${aiResponse.result.response}`
      } else {
        // Fallback to simple keyword matching if AI fails
        const keywords = preference.toLowerCase().split(' ')
        const matches = podcasts.filter((podcast: any) => 
          keywords.some(keyword => podcast.topic.toLowerCase().includes(keyword))
        )
        
        if (matches.length > 0) {
          const match = matches[0]
          const date = new Date(match.created_at).toLocaleDateString()
          return `🎯 Found a matching podcast!\n\n"${match.topic}"\n📅 Generated: ${date}\n🔗 Listen here: ${match.url}\n\nThis podcast matches your preference for: ${preference}`
        } else {
          return `😔 No podcasts found matching "${preference}". Try generating some podcasts with topics you're interested in first!`
        }
      }
    } catch (error) {
      return `Error getting recommendations: ${error}`
    }
  }
  
  /**
   * Search for podcasts by topic
   */
  @func()
  async searchPodcasts(
    /**
     * Search term to look for in podcast topics
     */
    searchTerm: string,
    /**
     * Cloudflare Account ID (optional - only needed for database access)
     */
    cloudflareAccountId?: Secret,
    /**
     * Cloudflare D1 Database ID (optional - only needed for database access)
     */
    cloudflareDatabaseId?: Secret,
    /**
     * Cloudflare API Token (optional - only needed for database access)
     */
    cloudflareApiToken?: Secret
  ): Promise<string> {
    // Check if all secrets are provided
    if (!cloudflareAccountId || !cloudflareDatabaseId || !cloudflareApiToken) {
      return "Error: Cloudflare credentials are required to access the database. Please provide all three secrets."
    }

    try {
      // Query the database for podcasts matching the search term
      const result = await dag
        .container()
        .from("curlimages/curl:latest")
        .withSecretVariable("ACCOUNT_ID", cloudflareAccountId)
        .withSecretVariable("DATABASE_ID", cloudflareDatabaseId)
        .withSecretVariable("API_TOKEN", cloudflareApiToken)
        .withExec([
          "sh", "-c",
          `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query" \\
           -H "Authorization: Bearer $API_TOKEN" \\
           -H "Content-Type: application/json" \\
           -d '{"sql":"SELECT topic, slug, url, created_at FROM podcasts WHERE topic LIKE ? ORDER BY created_at DESC","params":["%${searchTerm.replace(/"/g, '\\"')}%"]}'`
        ])
        .stdout()

      const response = JSON.parse(result)
      
      if (response.success && response.result && response.result[0] && response.result[0].results) {
        const podcasts = response.result[0].results
        
        if (podcasts.length === 0) {
          return `No podcasts found matching "${searchTerm}". Try a different search term.`
        }
        
        // Format the results nicely
        let output = `Found ${podcasts.length} podcast(s) matching "${searchTerm}":\n\n`
        
        podcasts.forEach((podcast: any, index: number) => {
          const date = new Date(podcast.created_at).toLocaleDateString()
          output += `${index + 1}. "${podcast.topic}"\n`
          output += `   📅 Generated: ${date}\n`
          output += `   🔗 URL: ${podcast.url}\n`
          output += `   📝 Slug: ${podcast.slug}\n\n`
        })
        
        return output
      } else {
        return "Error retrieving podcasts from database. Make sure your credentials are correct."
      }
    } catch (error) {
      return `Error searching database: ${error}`
    }
  }
  
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