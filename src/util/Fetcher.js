export const doFetch = (url, method, event, actions) => {
  const defaultAction = () => alert("Something went wrong!"); //TODO: add i18n

  if (!actions) {
    actions = {};
  }

  const responseHandler = async response => {
    const handler = actions[response.status] || actions.default || defaultAction;
    const data = await response.text();
    if (data) {
      handler(JSON.parse(data));
    } else {
      handler();
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
