import { mount as avoriazMount } from 'avoriaz';

import Root from './lifecycle/root.vue';
import i18n from '../../src/i18n';
import router from '../../src/router';
import store from '../../src/store';
import { transforms } from '../../src/store/modules/request/keys';



////////////////////////////////////////////////////////////////////////////////
// DESTROY

const componentsToDestroy = [];

export const destroyMarkedComponents = () => {
  for (const component of componentsToDestroy) {
    const { vm } = component;
    vm.$destroy();
    const { $el } = vm;
    if ($el.parentNode != null) $el.parentNode.removeChild($el);
  }
  componentsToDestroy.splice(0);
};



////////////////////////////////////////////////////////////////////////////////
// MOUNT

const successfulResponse = (data) => ({
  status: 200,
  data,
  get config() { throw new Error(); }
});
const problemResponse = (code) => ({
  status: Math.floor(code),
  data: { code, message: 'Problem' },
  get config() { throw new Error(); }
});
const setRequestData = (data) => {
  for (const [key, value] of Object.entries(data)) {
    const transform = transforms[key];
    if (transform == null && value.problem != null)
      throw new Error('unexpected problem response');
    const response = value.problem == null
      ? successfulResponse(value)
      : problemResponse(value);
    const transformed = transform != null ? transform(response) : response.data;
    store.commit('setData', { key, value: transformed });
  }
};

const optionsSupportedWithI18n = new Set([
  'propsData',
  'slots',
  'attachToDocument',
  'requestData'
]);

export const mount = (component, options = {}) => {
  // If the component uses a single file component i18n custom block, then its
  // $i18n property will be different from the root VueI18n object. Because most
  // components with an i18n custom block assume access to the root VueI18n
  // object, we will wrap the component in another component (Root), which will
  // be the root component and whose $i18n property will be the root VueI18n
  // object.
  if (component.__i18n != null) {
    for (const name of Object.keys(options)) {
      if (!optionsSupportedWithI18n.has(name)) {
        // Some mount() options will not work with the current strategy to use
        // Root.
        throw new Error('unknown or unsupported option');
      }
    }
    const root = mount(Root, {
      ...options,
      propsData: { component, props: options.propsData }
    });
    return root.first(component);
  }

  if (options.attachToDocument === true) {
    for (const componentToDestroy of componentsToDestroy) {
      if (componentToDestroy.vm.$el.parentNode != null)
        throw new Error('only one component can be attached to the document');
    }
  }

  const { requestData, ...mountOptions } = options;

  // Normalize the options.
  if (mountOptions.router === true) mountOptions.router = router;
  mountOptions.store = store;
  mountOptions.i18n = i18n;

  if (requestData != null) setRequestData(requestData);

  const wrapper = avoriazMount(component, mountOptions);
  componentsToDestroy.push(wrapper);
  return wrapper;
};

// Deprecated
export const mountAndMark = mount;
