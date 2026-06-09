/**
 * Worker-safe HTML parsing entry point.
 *
 * Combines parse5 (HTML5-conformant tag-soup recovery) with cheerio/slim's
 * selector engine. Avoids cheerio's full entry, which imports `node:stream`
 * for its streaming API and breaks Cloudflare Workers without `nodejs_compat`.
 */

import * as cheerio from "cheerio/slim";
import { parse as parse5 } from "parse5";
import { adapter } from "parse5-htmlparser2-tree-adapter";

/**
 * Parse an HTML string and return a cheerio query function.
 *
 * Uses parse5 with the htmlparser2 tree adapter to produce a DOM that
 * cheerio/slim can navigate. parse5's HTML5-conformant parser fixes up
 * malformed markup (mismatched tags, missing closers) the way browsers do —
 * htmlparser2 alone cannot.
 *
 * @param html - Raw HTML markup.
 * @returns A cheerio API bound to the parsed document.
 */
export function parseHtml(html: string): cheerio.CheerioAPI {
  const dom = parse5(html, { treeAdapter: adapter });
  return cheerio.load(dom);
}
