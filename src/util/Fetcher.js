export const doFetch = (url, method, event, actions) => {
  const defaultAction = () => alert("Something went wrong!"); //TODO: add i18n

  if (!actions) {
    actions = {};
  }

  const responseHandler = async response => {
    const handler = actions[response.status] || actions.default || defaultAction;
    try {
      if (typeof response.text === "function") {
        const data = await response.text();
        handler(data ? JSON.parse(data) : undefined);
        return;
      }

      if (typeof response.json === "function") {
        handler(await response.json());
        return;
      }

      handler();
    } catch (err) {
      console.log("Load failed");
    }
  };

  fetch(url, {
    method: method,
    headers:{
      "Content-Type": "application/json"
    },
    body: buildPayload(event),
  }).then(responseHandler);
};

const buildPayload = (event) => {
  if (event) {
    const data = new FormData(event.target);
    const payload = Object.fromEntries(data);
    return JSON.stringify(payload);
  } else {
    return null;
  }
};
