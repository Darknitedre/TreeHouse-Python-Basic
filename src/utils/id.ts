export function generateId(): string {
  const rand = () => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    if (c === 'x') return rand();
    const v = (Math.floor(Math.random() * 4) + 8) % 16;
    return v.toString(16);
  });
}
