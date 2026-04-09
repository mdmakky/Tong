import { useEffect } from 'react'

const SITE_NAME = 'Tong Chat'
const SITE_URL = 'https://tongchat.app'
const DEFAULT_IMAGE = `${SITE_URL}/tong-icon.svg`

function upsertMeta(selector, attrs, content) {
  let meta = document.head.querySelector(selector)
  if (!meta) {
    meta = document.createElement('meta')
    Object.entries(attrs).forEach(([key, value]) => meta.setAttribute(key, value))
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

function upsertLink(selector, attrs) {
  let link = document.head.querySelector(selector)
  if (!link) {
    link = document.createElement('link')
    document.head.appendChild(link)
  }
  Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value))
}

export default function useSeo({
  title,
  description,
  canonicalPath = '/',
  image = DEFAULT_IMAGE,
  noIndex = false,
}) {
  useEffect(() => {
    const resolvedTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
    const canonicalUrl = new URL(canonicalPath, SITE_URL).toString()
    const robots = noIndex ? 'noindex, nofollow' : 'index, follow'

    document.title = resolvedTitle

    upsertMeta('meta[name="description"]', { name: 'description' }, description)
    upsertMeta('meta[name="robots"]', { name: 'robots' }, robots)

    upsertMeta('meta[property="og:type"]', { property: 'og:type' }, 'website')
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, SITE_NAME)
    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, resolvedTitle)
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description)
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl)
    upsertMeta('meta[property="og:image"]', { property: 'og:image' }, image)

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, resolvedTitle)
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description)
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, image)

    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl })
  }, [title, description, canonicalPath, image, noIndex])
}
