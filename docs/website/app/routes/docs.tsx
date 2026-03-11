import type { Route } from './+types/docs';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle
} from 'fumadocs-ui/layouts/docs/page';
import { source } from '@/lib/source';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import browserCollections from 'fumadocs-mdx:collections/browser';
import { useFumadocsLoader } from 'fumadocs-core/source/client';

export const layoutOptions: BaseLayoutProps = {
  nav: { title: 'Expressive' },
  githubUrl: 'https://github.com/gabeklein/expressive-state'
};

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params['*'].split('/').filter((v) => v.length > 0);
  const page = source.getPage(slugs);
  if (!page) throw new Response('Not found', { status: 404 });

  return {
    slugs: page.slugs,
    path: page.path,
    pageTree: await source.serializePageTree(source.getPageTree())
  };
}

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: Mdx }) {
    return (
      <DocsPage toc={toc}>
        <title>{frontmatter.title}</title>
        <meta name="description" content={frontmatter.description} />
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <Mdx components={{ ...defaultMdxComponents }} />
        </DocsBody>
      </DocsPage>
    );
  }
});

export default function Page({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData);

  return (
    <DocsLayout {...layoutOptions} tree={pageTree}>
      {clientLoader.useContent(loaderData.path)}
    </DocsLayout>
  );
}
