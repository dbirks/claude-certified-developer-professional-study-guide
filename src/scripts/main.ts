// Client entry. Each module owns one concern; see docs/ARCHITECTURE.md. Order matters only for theme (first).
import { initTheme } from './theme';
import { initDrawer } from './drawer';
import { initToc } from './toc';
import { initReading } from './reading';
import { initSearch } from './search';
import { initCitations } from './cite';
import { initStudy } from './study';

initTheme();
initDrawer();
initToc();
initReading();
initSearch();
initCitations();
initStudy();
