// Components available in every MDX chapter without imports. See docs/ARCHITECTURE.md §MDX components.
import Cite from '../components/mdx/Cite.astro';
import Callout from '../components/mdx/Callout.astro';
import ExamLens from '../components/mdx/ExamLens.astro';
import SelfCheck from '../components/mdx/SelfCheck.astro';
import Figure from '../components/mdx/Figure.astro';
import Flow from '../components/mdx/Flow.astro';
import Sequence from '../components/mdx/Sequence.astro';

export const mdxComponents = { Cite, Callout, ExamLens, SelfCheck, Figure, Flow, Sequence };
