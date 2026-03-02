import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { XMLParser } from 'fast-xml-parser'

const FEED_URL = 'https://kittygiraudel.com/rss/index.xml'
const MAX_POSTS = 5
const MARKER_START = '<!-- BLOG-POST-LIST:START -->'
const MARKER_END = '<!-- BLOG-POST-LIST:END -->'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const readmePath = path.resolve(__dirname, '..', 'README.md')

async function fetchFeed() {
  try {
    const response = await fetch(FEED_URL)
    if (!response.ok) {
      console.error(`Failed to fetch feed: ${response.status} ${response.statusText}`)
      return null
    }

    const xml = await response.text()
    const parser = new XMLParser({
      ignoreAttributes: false,
    })

    const data = parser.parse(xml)
    const entries = data?.feed?.entry
    if (!entries || (Array.isArray(entries) && entries.length === 0)) {
      console.error('No entries found in feed.')
      return null
    }

    const items = Array.isArray(entries) ? entries : [entries]

    return items.slice(0, MAX_POSTS).map(entry => {
      const title = entry.title ?? 'Untitled'

      let url = null
      if (entry.link) {
        if (Array.isArray(entry.link)) {
          url = entry.link[0]['@_href'] ?? null
        } else {
          url = entry.link['@_href'] ?? null
        }
      }

      const published = entry.published ?? null
      let dateLabel = ''

      if (published) {
        const date = new Date(published)
        if (!Number.isNaN(date.getTime())) {
          dateLabel = date.toLocaleDateString('en-GB', {
            month: 'short',
            year: 'numeric',
          })
        }
      }

      return {
        title,
        url,
        published,
        dateLabel,
      }
    })
  } catch (error) {
    console.error('Error while fetching or parsing feed:', error)
    return null
  }
}

function buildMarkdown(posts) {
  if (!posts || posts.length === 0) {
    return 'Latest posts from [kittygiraudel.com](https://kittygiraudel.com) will appear here.'
  }

  const rows = posts
    .map(post => {
      const date = post.dateLabel || ''
      const link = post.url || 'https://kittygiraudel.com'
      const title = post.title.replace(/\|/g, '\\|')
      return `| ${date} | [**${title}**](${link}) |`
    })
    .join('\n')

  return [
    '| Date | Post |',
    '| ---- | ---- |',
    rows,
  ].join('\n')
}

function updateReadmeBlock(content, block) {
  const startIndex = content.indexOf(MARKER_START)
  const endIndex = content.indexOf(MARKER_END)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    console.error('Could not find blog post markers in README.md')
    return content
  }

  const before = content.slice(0, startIndex + MARKER_START.length)
  const after = content.slice(endIndex)

  return `${before}\n\n${block}\n${after}`
}

async function main() {
  const posts = await fetchFeed()
  if (!posts) {
    // Leave README unchanged if we cannot fetch/parse the feed
    process.exit(0)
  }

  const block = buildMarkdown(posts)

  let readme
  try {
    readme = fs.readFileSync(readmePath, 'utf8')
  } catch (error) {
    console.error('Could not read README.md:', error)
    process.exit(1)
  }

  const updated = updateReadmeBlock(readme, block)

  if (updated === readme) {
    console.log('README.md is already up to date.')
    process.exit(0)
  }

  try {
    fs.writeFileSync(readmePath, updated, 'utf8')
    console.log('README.md updated with latest blog posts.')
  } catch (error) {
    console.error('Could not write README.md:', error)
    process.exit(1)
  }
}

main()

