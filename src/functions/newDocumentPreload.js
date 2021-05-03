
// source: https://intoli.com/blog/making-chrome-headless-undetectable/

const getParameter = WebGLRenderingContext.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  // UNMASKED_VENDOR_WEBGL
  if (parameter === 37445) {
    return 'Intel Open Source Technology Center';
  }
  // UNMASKED_RENDERER_WEBGL
  if (parameter === 37446) {
    return 'Mesa DRI Intel(R) Ivybridge Mobile ';
  }

  return getParameter(parameter);
};

// overwrite the `languages` property to use a custom getter
Object.defineProperty(navigator, "languages", {
    get: function() {
      return ["en-US", "en"];
    }
});
  
// overwrite the `plugins` property to use a custom getter
Object.defineProperty(navigator, 'plugins', {
    get: function() {
        // this just needs to have `length > 0`, but we could mock the plugins too
        return [1, 2, 3, 4, 5];
    },
});

Object.defineProperty(navigator, 'webdriver', { 
    get: () => false, 
});

['height', 'width'].forEach(property => {
    // store the existing descriptor
    const imageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, property);

    // redefine the property with a patched descriptor
    Object.defineProperty(HTMLImageElement.prototype, property, {
        ...imageDescriptor,
        get: function() {
        // return an arbitrary non-zero dimension if the image failed to load
        if (this.complete && this.naturalHeight == 0) {
            return 20;
        }
        // otherwise, return the actual dimension
        return imageDescriptor.get.apply(this);
        },
    });
});

// The last method proposed was to detect support for retina hairlines using the Modernizr library. This is another test that doesn’t really make a ton of 
// sense because the majority of people don’t have HiDPI screens and most users’ browsers won’t support this feature. It would, however, be trivial to bypass 
// even if it did make sense to use as a test.
// store the existing descriptor
const elementDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
// redefine the property with a patched descriptor
Object.defineProperty(HTMLDivElement.prototype, 'offsetHeight', {
  ...elementDescriptor,
  get: function() {
    if (this.id === 'modernizr') {
        return 1;
    }
    return elementDescriptor.get.apply(this);
  },
});

// reset of the webdriver property
const newProto = navigator.__proto__;
delete newProto.webdriver;
navigator.__proto__ = newProto;
// redundant reset of the navigator
// window.navigator = {}