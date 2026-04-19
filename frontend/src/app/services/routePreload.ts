let mapsPreloadPromise: Promise<void> | null = null;

export function loadClientMapPage() {
  return import("../pages/client/ClientMapPage");
}

export function loadAdminMapPage() {
  return import("../pages/admin/AdminMapPage");
}

export function preloadMapRoutes(): Promise<void> {
  if (!mapsPreloadPromise) {
    mapsPreloadPromise = Promise.all([loadClientMapPage(), loadAdminMapPage()]).then(() => undefined);
  }

  return mapsPreloadPromise;
}
