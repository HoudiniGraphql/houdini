package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
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
		} else if item.Name() == "+page.js" {
			os.Remove(itemPath)
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
