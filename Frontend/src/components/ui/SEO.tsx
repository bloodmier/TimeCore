import { useEffect } from "react";

type SEOProps = {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  themeColor?: string;
};

export function SEO({
  title,
  description,
  canonical,
  ogImage,
  themeColor = "#0b1220",
}: SEOProps) {
  useEffect(() => {
    document.title = title;

    const upsert = (selector: string, create: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      return el;
    };

    const metaDesc = upsert('meta[name="description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      return m;
    });
    metaDesc.setAttribute("content", description);

    const metaTheme = upsert('meta[name="theme-color"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      return m;
    });
    metaTheme.setAttribute("content", themeColor);

    if (canonical) {
      const linkCanon = upsert('link[rel="canonical"]', () => {
        const l = document.createElement("link");
        l.setAttribute("rel", "canonical");
        return l;
      }) as HTMLLinkElement;
      linkCanon.href = canonical;
    }

    const og = (property: string, content: string) => {
      const tag = upsert(`meta[property="${property}"]`, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", property);
        return m;
      });
      tag.setAttribute("content", content);
    };

    og("og:title", title);
    og("og:description", description);
    if (canonical) og("og:url", canonical);
    if (ogImage) og("og:image", ogImage);

  }, [title, description, canonical, ogImage, themeColor]);

  return null;
}
