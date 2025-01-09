import { App } from 'astal/gtk3';

import style from './style.scss';
import Bar from './Widget/Bar.js';

App.start({
  css: style,
  instanceName: 'astal',
  main: () => {
    App.get_monitors().map(Bar);
  },
  requestHandler: (request, res) => {
    print(request);
    res('ok');
  },
});
