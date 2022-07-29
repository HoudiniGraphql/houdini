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

		if item.IsDir() {
			err = processDirectory(itemPath)
		} else if item.Name() == "__error.svelte" {
			err = copyAndDelete(itemPath, path.Join(dirPath, "+error.svelte"))
		} else if item.Name() == "__layout.svelte" {
			err = copyAndDelete(itemPath, path.Join(dirPath, "+layout.svelte"))
		} else if item.Name() == "index.svelte" {
			err = copyAndDelete(itemPath, path.Join(dirPath, "+page.svelte"))
		} else {
			extension := filepath.Ext(itemPath)
			name := strings.TrimSuffix(item.Name(), extension)

			// if we are looking at a svelte file we need to move it to a directory with the same name
			// as a +page.svelte file
			err = copyAndDelete(itemPath, path.Join(itemPath, name, "+page.svelte"))
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
		return err
	}

	err = ioutil.WriteFile(path.Join(cwd, new), input, 0644)
	if err != nil {
		return err
	}

	// return os.Remove(old)
	return nil
}
