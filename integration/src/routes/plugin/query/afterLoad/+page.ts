export function afterLoad({ data }) {
  return {
    message: data.PreprocessorAfterLoadTestQuery.user.name[0]
  };
}
