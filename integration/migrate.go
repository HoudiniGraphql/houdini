package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func main() {
	err := processDirectory("./src/routes")
	if err != nil {
		fmt.Println(err)
		return
	}

}

func processDirectory(dirPath string) error {
	content, err := ioutil.ReadDir(dirPath)
	if err != nil {
		panic(err)
	}

	for _, item := range content {
		itemPath := path.Join(dirPath, item.Name())
		extension := filepath.Ext(item.Name())
		name := strings.TrimSuffix(item.Name(), extension)

		switch {
		case item.IsDir():
			err = processDirectory(itemPath)
		case item.Name() == "__error.svelte":
			err = copyAndDelete(itemPath, path.Join(dirPath, "+error.svelte"))
		case item.Name() == "__layout.svelte":
			err = copyAndDelete(itemPath, path.Join(dirPath, "+layout.svelte"))
		case item.Name() == "index.svelte":
			err = copyAndDelete(itemPath, path.Join(dirPath, "+page.svelte"))
		case strings.HasSuffix(name, ".spec"):
			name = strings.TrimSuffix(name, filepath.Ext(name))

			err = copyAndDelete(itemPath, path.Join(dirPath, name, "spec.ts"))
		case extension == ".gql", extension == ".graphql":
			continue
		default:
			err = copyAndDelete(itemPath, path.Join(dirPath, name, "+page.svelte"))
		}

		if err != nil {
			return err
		}
	}

	return nil
}

func copyAndDelete(old string, new string) error {
	cwd, err := os.Getwd()
	if err != nil {
		log.Println(err)
	}

	input, err := ioutil.ReadFile(path.Join(cwd, old))
	if err != nil {
		return fmt.Errorf("error reading file: %s", err.Error())
	}

	err = os.MkdirAll(filepath.Dir(new), os.ModePerm)

	err = ioutil.WriteFile(path.Join(cwd, new), input, 0644)
	if err != nil {
		return fmt.Errorf("error writing file: %s", err.Error())
	}

	return os.Remove(old)
}
