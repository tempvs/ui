type FetchAction = (data?: unknown) => unknown;
type FetchActions = Record<number | string, FetchAction | undefined> & {
  default?: FetchAction;
};

type FetchFormEvent = {
  currentTarget?: HTMLFormElement;
  target?: EventTarget | null;
} | null | undefined;

function buildPayload(event: FetchFormEvent): string | null {
  if (event) {
    const form = event.currentTarget || event.target;
    if (!(form instanceof HTMLFormElement)) {
      return null;
    }

    const data = new FormData(form);
    const payload = Object.fromEntries(data);
    return JSON.stringify(payload);
  }

  return null;
}

export const doFetch = (
  url: string,
  method: string,
  event: FetchFormEvent,
  actions: FetchActions = {}
): void => {
  const defaultAction = () => alert('Something went wrong!'); // TODO: add i18n

  const responseHandler = async (response: Response) => {
    const handler = actions[response.status] || actions.default || defaultAction;
    try {
      if (typeof response.text === 'function') {
        const data = await response.text();
        if (!data) {
          handler();
          return;
        }

        try {
          handler(JSON.parse(data));
        } catch (parseError) {
          handler(data);
        }
        return;
      }

      if (typeof response.json === 'function') {
        handler(await response.json());
        return;
      }

      handler();
    } catch (err) {
      handler();
    }
  };

  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: buildPayload(event),
  }).then(responseHandler);
};
